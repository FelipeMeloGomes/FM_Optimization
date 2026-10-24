import { app, BrowserWindow, Notification } from 'electron';
import type {
  AutoCleanRunResult,
  AutoCleanSettings,
  AutoCleanStatus,
} from '../../shared/ipc-types';
import { isAdmin } from './admin-check';
import { computeNextRunAt } from './auto-clean-schedule';
import { loadSettings, saveSettings } from './data-service';
import { runScriptSilently } from './script-executor';
import { getScriptById } from './script-registry';

/** Teto do timer: revalida contra o relógio para sobreviver a suspensão/drift. */
const MAX_TIMER_MS = 60 * 60 * 1_000;
/** Atraso tolerado antes de considerar o horário perdido (sem catch-up). */
const STALE_GRACE_MS = 10 * 60 * 1_000;

function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return;
  new Notification({ title, body, silent: false }).show();
}

function scriptName(id: string): string {
  return getScriptById(id)?.name ?? id;
}

/**
 * Identidade dos campos que definem o agendamento. Comparar string em vez de
 * JSON evita que a ordem das chaves (renderer × disco) force um reagendamento.
 */
function scheduleFingerprint(settings: AutoCleanSettings): string {
  return [
    settings.enabled,
    settings.cleaners.join(','),
    settings.frequency,
    settings.weekday,
    settings.dayOfMonth,
    settings.time,
    settings.runOnStartup,
    settings.catchUp,
  ].join('|');
}

function isWindowVisible(): boolean {
  return BrowserWindow.getAllWindows().some((win) => !win.isDestroyed() && win.isVisible());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function setLaunchAtLogin(enabled: boolean): void {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] });
}

export class AutoCleanScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly listeners = new Set<(status: AutoCleanStatus) => void>();

  constructor(
    private readonly onStatus: (status: AutoCleanStatus) => void,
    private readonly onFinished: (result: AutoCleanRunResult) => void
  ) {}

  subscribe(listener: (status: AutoCleanStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitStatus(status: AutoCleanStatus): void {
    this.onStatus(status);
    for (const listener of this.listeners) listener(status);
  }

  getStatus(): AutoCleanStatus {
    const { autoClean } = loadSettings();
    return {
      settings: autoClean,
      isAdmin: isAdmin(),
      running: this.running,
    };
  }

  /** Reagenda a partir do que está em disco. Chamar no boot e após cada update. */
  start(): void {
    const { autoClean } = loadSettings();
    if (!autoClean.enabled) {
      this.reschedule(autoClean);
      return;
    }

    const overdue = autoClean.nextRunAt !== null && autoClean.nextRunAt <= Date.now();
    // Sem catch-up, um horário perdido não vira execução atrasada: apenas
    // rola para a próxima ocorrência. Com catch-up, `catchUp()` decide.
    if (autoClean.nextRunAt === null || (overdue && !autoClean.catchUp)) {
      const settings = loadSettings();
      settings.autoClean.nextRunAt = computeNextRunAt(settings.autoClean, Date.now());
      saveSettings(settings);
    }

    this.reschedule(loadSettings().autoClean);
  }

  /**
   * Aplica a configuração vinda do renderer. Só recalcula `nextRunAt` quando os
   * campos de agendamento mudaram de verdade — salvar o tema não pode rolar um
   * horário atrasado para frente. `previous` é o estado lido antes de salvar,
   * porque `config` já está em disco quando este método roda.
   */
  applyConfig(config: AutoCleanSettings, previous: AutoCleanSettings): AutoCleanStatus {
    const schedulingChanged = scheduleFingerprint(config) !== scheduleFingerprint(previous);

    if (schedulingChanged) {
      const settings = loadSettings();
      settings.autoClean = {
        ...config,
        lastRunAt: settings.autoClean.lastRunAt,
        pending: settings.autoClean.pending,
        nextRunAt: config.enabled ? computeNextRunAt(config, Date.now()) : null,
      };
      saveSettings(settings);
      this.reschedule(settings.autoClean);
    }

    const status = this.getStatus();
    this.emitStatus(status);
    return status;
  }

  update(mutate: (settings: AutoCleanSettings) => void, notifyRenderer = true): AutoCleanSettings {
    const settings = loadSettings();
    mutate(settings.autoClean);
    if (settings.autoClean.enabled) {
      settings.autoClean.nextRunAt = computeNextRunAt(settings.autoClean, Date.now());
    } else {
      settings.autoClean.nextRunAt = null;
    }
    saveSettings(settings);
    this.reschedule(settings.autoClean);
    if (notifyRenderer) this.emitStatus(this.getStatus());
    return settings.autoClean;
  }

  /** Sincroniza o autostart real do Windows com o toggle. */
  syncLaunchAtLogin(): void {
    const { autoClean } = loadSettings();
    if (!autoClean.enabled) {
      setLaunchAtLogin(false);
      return;
    }
    setLaunchAtLogin(autoClean.runOnStartup);
  }

  async runNow(ids: string[]): Promise<AutoCleanRunResult> {
    return this.execute(ids, 'manual');
  }

  discardPending(ids: string[]): AutoCleanStatus {
    const drop = new Set(ids);
    this.update((current) => {
      current.pending = current.pending.filter((id) => !drop.has(id));
    });
    return this.getStatus();
  }

  /**
   * Executa uma limpeza em série. Quem exige admin e não tem vira pendência em
   * vez de falhar — a fila nunca fica presa numa limpeza impossível.
   */
  private async execute(
    ids: string[],
    trigger: 'manual' | 'scheduled'
  ): Promise<AutoCleanRunResult> {
    if (this.running) {
      return { ran: [], pending: [], failed: [] };
    }

    this.running = true;
    this.emitStatus(this.getStatus());

    const elevated = isAdmin();
    const ran: string[] = [];
    const pending: string[] = [];
    const failed: string[] = [];

    try {
      for (const id of ids) {
        const script = getScriptById(id);
        if (!script) continue;
        if (script.requiresAdmin && !elevated) {
          pending.push(id);
          continue;
        }
        try {
          const completion = await runScriptSilently(id);
          if (completion.code === 0) ran.push(id);
          else failed.push(id);
        } catch {
          failed.push(id);
        }
      }
    } finally {
      this.running = false;
    }

    const before = new Set(loadSettings().autoClean.pending);
    const after = this.update((current) => {
      const resolved = new Set([...ran, ...failed]);
      const remaining = current.pending.filter((id) => !resolved.has(id));
      const merged = new Set([...remaining, ...pending]);
      current.pending = [...merged];
      if (trigger === 'scheduled') current.lastRunAt = Date.now();
    });

    const newPending = after.pending.filter((id) => !before.has(id));
    const result: AutoCleanRunResult = {
      ran,
      pending: after.pending,
      failed,
    };
    this.onFinished(result);
    this.announce({ ran, failed, newPending });

    return result;
  }

  /** Toast interno quando há janela visível; notificação nativa quando está no tray. */
  private announce(result: { ran: string[]; failed: string[]; newPending: string[] }): void {
    const parts: string[] = [];
    if (result.ran.length > 0) parts.push(`Executadas: ${result.ran.map(scriptName).join(', ')}`);
    if (result.failed.length > 0)
      parts.push(`Falharam: ${result.failed.map(scriptName).join(', ')}`);
    if (result.newPending.length > 0) {
      parts.push(`${result.newPending.length} precisam de admin`);
    }
    if (parts.length === 0) return;

    const body = parts.join(' · ');
    if (isWindowVisible()) return; // o renderer mostra o toast
    notify('Limpeza automática', body);
  }

  private reschedule(settings: AutoCleanSettings): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!settings.enabled || settings.nextRunAt === null) return;

    const remaining = settings.nextRunAt - Date.now();
    // Atrasado fica para o catch-up (ou já foi rolado no start): um timer de
    // 0ms aqui viraria laço de execução.
    if (remaining <= 0) return;

    this.timer = setTimeout(
      () => {
        void this.tick();
      },
      Math.min(remaining, MAX_TIMER_MS)
    );
  }

  private async tick(): Promise<void> {
    const { autoClean } = loadSettings();
    if (!autoClean.enabled) return;
    if (autoClean.nextRunAt === null || autoClean.nextRunAt > Date.now()) {
      this.reschedule(autoClean);
      return;
    }

    // Suspensão longa: sem catch-up, o horário perdido não vira execução.
    const lag = Date.now() - autoClean.nextRunAt;
    if (!autoClean.catchUp && lag > STALE_GRACE_MS) {
      this.update(() => {});
      return;
    }

    if (this.running) {
      this.timer = setTimeout(() => {
        void this.tick();
      }, 60_000);
      return;
    }

    await this.execute(autoClean.cleaners, 'scheduled');
  }

  /** Chamado em `powerMonitor.resume`: o timer pode ter dormido junto com o PC. */
  handleResume(): void {
    void this.tick();
  }

  /**
   * Catch-up no boot. `explicitIntent` vem de `--relaunch-elevated`: o usuário
   * acabou de pedir a elevação, então roda as pendências sem esperar horário.
   */
  async catchUp(options: { explicitIntent: boolean; delayMs: number }): Promise<void> {
    const { autoClean } = loadSettings();
    if (!autoClean.enabled) return;

    if (options.explicitIntent) {
      if (autoClean.pending.length === 0) return;
      if (options.delayMs > 0) await sleep(options.delayMs);
      await this.execute(autoClean.pending, 'scheduled');
      return;
    }

    if (!autoClean.catchUp) return;
    if (autoClean.nextRunAt === null || autoClean.nextRunAt > Date.now()) return;
    if (options.delayMs > 0) await sleep(options.delayMs);

    const latest = loadSettings().autoClean;
    if (latest.nextRunAt === null || latest.nextRunAt > Date.now()) return;
    await this.execute(latest.cleaners, 'scheduled');
  }
}
