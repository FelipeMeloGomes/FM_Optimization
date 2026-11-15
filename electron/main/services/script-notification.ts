import { Notification } from 'electron';
import type { ScriptEnded } from '../../shared/ipc-types';

export interface ScriptEndedNotification {
  title: string;
  body: string;
}

/**
 * Texto da notificacao nativa de fim de script. Devolve `null` para limpeza
 * agendada: o `AutoCleanScheduler` ja anuncia o resultado dela, e as duas
 * notificacoes apareceriam juntas.
 */
export function buildScriptEndedNotification(data: ScriptEnded): ScriptEndedNotification | null {
  if (data.trigger === 'scheduled') return null;

  const name = data.scriptName?.trim() || data.id;

  if (data.cancelled) return { title: 'Script cancelado', body: name };
  if (data.code === 0) return { title: 'Script concluído', body: name };
  // `null` sem cancelamento = desfecho desconhecido (handoff de menu), nao falha.
  if (data.code === null) return { title: 'Script finalizado', body: name };
  return { title: 'Script falhou', body: `${name} (código ${data.code})` };
}

/**
 * Notifica quando o evento nao chegou a nenhuma janela. `delivered` diz se
 * algum webContents recebeu `script-ended`; se recebeu, o toast do renderer
 * (com som, conforme a configuracao) ja cobre o aviso.
 */
export function notifyScriptEnded(data: ScriptEnded, delivered: boolean): boolean {
  if (delivered) return false;

  const notification = buildScriptEndedNotification(data);
  if (!notification) return false;
  if (!Notification.isSupported()) return false;

  new Notification({ ...notification, silent: false }).show();
  return true;
}
