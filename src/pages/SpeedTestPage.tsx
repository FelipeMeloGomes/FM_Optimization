import { Activity, AlertCircle, Play, RotateCcw, Square, Wifi } from 'lucide-react';
import type { SpeedTestPhase } from '../../electron/shared/ipc-types';
import { SpeedGauge } from '../components/SpeedGauge';
import { Button, Card, CardContent, Progress } from '../components/ui';
import { SpeedProvider, useSpeedContext } from '../contexts/SpeedContext';

const PHASE_LABEL: Record<SpeedTestPhase, string> = {
  latency: 'Medindo latência…',
  download: 'Medindo download…',
  upload: 'Medindo upload…',
  done: 'Concluído',
};

export default function SpeedTestPage() {
  return (
    <SpeedProvider>
      <SpeedTestPageContent />
    </SpeedProvider>
  );
}

function ResultCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground">{unit}</p>
      </CardContent>
    </Card>
  );
}

function SpeedTestPageContent() {
  const { status, progress, result, error, start, cancel } = useSpeedContext();

  // O evento final de progresso não carrega Mbps: o resultado travado vem do
  // resultado da medição, não do último aviso de progresso.
  const gaugeValue = status === 'done' ? (result?.downloadMbps ?? 0) : (progress.currentMbps ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Activity className="size-4 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Teste de Velocidade</h2>
          <p className="text-sm text-muted-foreground">
            Meça download, upload, ping e jitter da sua conexão
          </p>
        </div>
      </div>

      <Card className="border-primary/20">
        <CardContent className="flex flex-col items-center gap-5 p-6 sm:p-8">
          <SpeedGauge
            valueMbps={gaugeValue}
            progress={progress.progress}
            label="Download"
            phase={progress.phase}
            active={status === 'measuring'}
          />

          {status === 'measuring' && (
            <div className="w-full max-w-md space-y-2" role="status" aria-live="polite">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{PHASE_LABEL[progress.phase]}</span>
                <span>{Math.round(progress.progress * 100)}%</span>
              </div>
              <Progress
                value={progress.progress * 100}
                ariaLabel="Progresso do teste"
                className="h-2"
              />
            </div>
          )}

          {status === 'idle' && (
            <Button
              size="lg"
              onClick={() => void start()}
              className="gap-2 px-8 font-semibold shadow-[0_0_20px_var(--color-selection)]"
            >
              <Play className="size-4" />
              Iniciar
            </Button>
          )}

          {status === 'measuring' && (
            <Button
              size="lg"
              variant="outline"
              onClick={() => void cancel()}
              className="gap-2 px-8"
            >
              <Square className="size-4" />
              Cancelar
            </Button>
          )}

          {status === 'done' && (
            <Button size="lg" onClick={() => void start()} className="gap-2 px-8">
              <RotateCcw className="size-4" />
              Testar novamente
            </Button>
          )}
        </CardContent>
      </Card>

      {status === 'error' && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4"
        >
          <AlertCircle className="size-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">
              Não foi possível medir a velocidade
            </p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void start()} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            Tentar novamente
          </Button>
        </div>
      )}

      {status === 'done' && result && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ResultCard label="Download" value={result.downloadMbps.toFixed(1)} unit="Mbps" />
          <ResultCard label="Upload" value={result.uploadMbps.toFixed(1)} unit="Mbps" />
          <ResultCard label="Ping" value={String(Math.round(result.pingMs))} unit="ms" />
          <ResultCard label="Jitter" value={String(Math.round(result.jitterMs))} unit="ms" />
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wifi className="size-3.5" />A medição usa os servidores da Cloudflare e não salva
        resultados.
      </p>
    </div>
  );
}
