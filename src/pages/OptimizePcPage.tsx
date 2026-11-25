import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Loader2,
  Lock,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type {
  OptimizationProgress,
  OptimizationReport,
  OptimizationSummary,
  OptimizationTweakStatus,
} from '../../electron/shared/ipc-types';
import { showEnhancedToast } from '../components/EnhancedToast';
import { AnimatedHero } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { RouteIcon } from '../components/hero/RouteIcon';
import { PageSkeleton } from '../components/PageSkeleton';
import BlurText from '../components/react-bits/BlurText';
import GlareHover from '../components/react-bits/GlareHover';
import { RISK_STYLES } from '../components/ScriptCard';
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Progress,
  Switch,
} from '../components/ui';
import { useSettingsContext } from '../contexts/SettingsContext';

const STATUS_LABELS: Record<OptimizationTweakStatus['status'], string> = {
  applied: 'Aplicado',
  pending: 'Pendente',
  unknown: 'Não verificado',
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Página "Otimizar PC": análise sob demanda do estado atual contra o plano
 * curado de ajustes persistentes, nota de aderência e aplicação em lote.
 *
 * A análise nunca roda no startup — o usuário decide quando consultar o
 * registro, o netsh e o powercfg. A nota mede aderência ao plano, não
 * desempenho medido.
 */
export default function OptimizePcPage() {
  const { settings } = useSettingsContext();
  const [report, setReport] = useState<OptimizationReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [simulation, setSimulation] = useState(false);
  const [elevating, setElevating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState<OptimizationProgress | null>(null);
  const [summary, setSummary] = useState<OptimizationSummary | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.electronAPI
      .isAdmin()
      .then((value) => {
        if (!cancelled) setIsAdmin(value);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    window.electronAPI
      .isPackaged()
      .then((value) => {
        if (!cancelled) setDevMode(!value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const analyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      setReport(await window.electronAPI.analyzeOptimization());
    } catch (error) {
      const message = errorMessage(error);
      setAnalysisError(message);
      showEnhancedToast({
        type: 'error',
        title: 'Não foi possível analisar o PC',
        description: message,
        duration: 'long',
        sound: settings.soundEnabled,
      });
    } finally {
      setAnalyzing(false);
    }
  }, [settings.soundEnabled]);

  const apply = useCallback(async () => {
    setConfirmOpen(false);
    setApplying(true);
    setApplyError(null);
    setSummary(null);
    setProgress(null);

    const unsubscribe = window.electronAPI.onOptimizationProgress(setProgress);
    try {
      const result = await window.electronAPI.applyOptimization();
      setSummary(result);
      showEnhancedToast({
        type: result.failed.length > 0 ? 'warning' : 'success',
        title: simulation ? 'Simulação concluída' : 'Otimização concluída',
        description: `${result.applied.length} ajuste(s) aplicado(s).`,
        duration: 'long',
        sound: settings.soundEnabled,
      });
      await analyze();
    } catch (error) {
      const message = errorMessage(error);
      setApplyError(message);
      showEnhancedToast({
        type: 'error',
        title: 'Não foi possível aplicar as otimizações',
        description: message,
        duration: 'long',
        sound: settings.soundEnabled,
      });
    } finally {
      unsubscribe();
      setApplying(false);
      setProgress(null);
    }
  }, [analyze, settings.soundEnabled, simulation]);

  const relaunchAsAdmin = useCallback(async () => {
    setElevating(true);
    try {
      await window.electronAPI.elevateApp(undefined, undefined, undefined, true);
    } catch (error) {
      showEnhancedToast({
        type: 'error',
        title: 'Não foi possível reiniciar como admin',
        description: errorMessage(error),
        duration: 'long',
        sound: settings.soundEnabled,
      });
    } finally {
      setElevating(false);
    }
  }, [settings.soundEnabled]);

  const pending = report?.tweaks.filter((tweak) => tweak.status === 'pending') ?? [];
  const canAnalyze = !analyzing && !applying;

  return (
    <div className="space-y-6">
      <HeroBanner visual={<AnimatedHero path="/otimizar-pc" animation="scan" />}>
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <RouteIcon path="/otimizar-pc" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Otimizar PC
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Otimize seu PC em um clique</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Comparamos o estado atual do Windows com 16 ajustes persistentes conhecidos. Você vê o
            que já está aplicado, o que falta e aplica tudo de uma vez com um ponto de restauração.
          </p>
        </div>
      </HeroBanner>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">
          A análise consulta registro, rede e energia. Ela só começa quando você clicar no botão.
        </p>
        <Button onClick={() => void analyze()} disabled={!canAnalyze} className="gap-1.5">
          {analyzing ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Analisando…
            </>
          ) : (
            <>
              <Play className="size-4" aria-hidden="true" />
              {report ? 'Analisar novamente' : 'Analisar PC'}
            </>
          )}
        </Button>
      </div>

      {devMode && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground">Modo simulação (dev)</p>
            <p className="text-[11px] text-muted-foreground">
              A análise continua real; aplicar não grava registro, não cria ponto de restauração e
              não executa scripts.
            </p>
          </div>
          <Switch
            checked={simulation}
            onCheckedChange={(checked) => {
              setSimulation(checked);
              void window.electronAPI.setOptimizationSimulation(checked);
            }}
            aria-label="Modo simulação"
          />
        </div>
      )}

      {simulation && (
        <div
          role="status"
          className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary"
        >
          Simulação ativa — nenhuma alteração será gravada no Windows.
        </div>
      )}

      {analysisError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2"
        >
          <p className="flex-1 text-xs text-destructive">
            Não foi possível analisar o PC: {analysisError}
          </p>
          <Button variant="outline" size="sm" onClick={() => void analyze()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {analyzing && !report && <PageSkeleton layout="analysis" label="Analisando o PC…" />}

      {!analyzing && !report && !analysisError && (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-12 text-center">
          <CircleHelp className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-foreground">Nenhuma análise feita ainda</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Clique em “Analisar PC” para ver o índice de otimização e as pendências.
          </p>
        </div>
      )}

      {report && (
        <>
          <section aria-label="Resultado da análise" className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Índice de otimização</CardTitle>
              </CardHeader>
              <CardContent>
                {report.score === null ? (
                  <p className="text-sm text-muted-foreground">Indisponível</p>
                ) : (
                  <>
                    <AnimatedNumber
                      value={report.score}
                      suffix="/10"
                      className="text-4xl font-bold text-foreground"
                    />
                    <span className="sr-only">Nota {report.score} de 10</span>
                  </>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {report.applied} de {report.total} ajustes aplicados
                  {report.unknown > 0 ? ` · ${report.unknown} não verificado(s)` : ''}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  A nota mede aderência ao plano, não desempenho medido.
                </p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Por área</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Cobertura</span> mostra quantos
                  ajustes já estão aplicados; o{' '}
                  <span className="font-medium text-foreground">índice</span> é a nota de 0 a 10 da
                  área.
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {report.areas.map((area) => (
                    <GlareHover
                      key={area.area}
                      width="100%"
                      height="auto"
                      borderRadius="0.625rem"
                      borderColor="transparent"
                      glareOpacity={0.14}
                      rimGlint={false}
                      className="bg-muted/30"
                    >
                      <div className="w-full p-3">
                        <div className="flex items-center justify-between gap-2">
                          <BlurText
                            text={area.label}
                            trigger="load"
                            animateBy="words"
                            className="min-w-0 text-xs font-medium text-foreground"
                          />
                          <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                            <AnimatedNumber value={area.applied} />/{area.total}
                          </span>
                        </div>
                        <Progress
                          value={area.total > 0 ? (area.applied / area.total) * 100 : 0}
                          ariaLabel={`${area.label}: ${area.applied} de ${area.total} ajustes aplicados`}
                          className="mt-2 h-1.5"
                        />
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Índice
                          </span>
                          {area.score === null ? (
                            <span className="text-[11px] text-muted-foreground">Sem índice</span>
                          ) : (
                            <>
                              <AnimatedNumber
                                value={area.score}
                                suffix="/10"
                                className="text-xs font-semibold text-primary"
                              />
                              <span className="sr-only">
                                Índice de {area.label}: {area.score} de 10
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </GlareHover>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {isAdmin === false && pending.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3">
              <Lock className="size-4 shrink-0 text-warning" aria-hidden="true" />
              <p className="flex-1 text-xs text-warning">
                Aplicar ajustes precisa de administrador. O resultado continua visível para
                consulta.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void relaunchAsAdmin()}
                disabled={elevating || applying}
                className="gap-1.5"
              >
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Reiniciar como admin
              </Button>
            </div>
          )}

          <section aria-label="Ajustes pendentes" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {pending.length === 0
                  ? 'Nenhum ajuste pendente'
                  : `${pending.length} ajuste(s) pendente(s)`}
              </p>
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={pending.length === 0 || applying || isAdmin !== true}
                className="gap-1.5"
              >
                {simulation ? 'Simular aplicação' : 'Aplicar otimizações'}
              </Button>
            </div>

            {applying && (
              <div role="status" className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-foreground">
                  {progress
                    ? `Aplicando ${progress.current} de ${progress.total}: ${progress.name}`
                    : 'Preparando a aplicação…'}
                </p>
                <Progress
                  value={progress ? (progress.current / progress.total) * 100 : 0}
                  ariaLabel="Progresso da otimização"
                  className="mt-2 h-1.5"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5"
                  onClick={() => void window.electronAPI.cancelOptimization()}
                >
                  <Square className="size-3" aria-hidden="true" />
                  Cancelar
                </Button>
              </div>
            )}

            {applyError && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              >
                Não foi possível aplicar as otimizações: {applyError}
              </div>
            )}

            {summary && (
              <div
                role="status"
                className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-xs text-success"
              >
                <p className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {summary.cancelled ? 'Aplicação cancelada' : 'Aplicação concluída'}
                </p>
                <p className="mt-1">
                  {summary.applied.length} aplicado(s) · {summary.failed.length} falha(s) ·{' '}
                  {summary.skipped.length} ignorado(s)
                </p>
                {summary.failed.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {summary.failed.map((failure) => (
                      <li key={failure.id}>
                        {failure.name}: {failure.error}
                      </li>
                    ))}
                  </ul>
                )}
                {summary.requiresRestart.length > 0 && (
                  <p className="mt-2 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                    Reinicie o PC para concluir: {summary.requiresRestart.join(', ')}
                  </p>
                )}
              </div>
            )}

            <ul className="space-y-2">
              {report.tweaks.map((tweak) => {
                const risk = RISK_STYLES[tweak.riskLevel] ?? RISK_STYLES.moderate;
                return (
                  <li
                    key={tweak.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{tweak.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{tweak.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className={risk.className}>
                          {risk.label}
                        </Badge>
                        {tweak.requiresRestart && <Badge variant="outline">Requer reinício</Badge>}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {STATUS_LABELS[tweak.status]}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar otimizações?</DialogTitle>
            <DialogDescription>
              Um ponto de restauração será criado antes de aplicar {pending.length} ajuste(s) em
              sequência. Se um falhar, os demais continuam. Você poderá cancelar a qualquer momento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void apply()} disabled={isAdmin !== true}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Aplicar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
