import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  Clock,
  MousePointerClick,
  PauseCircle,
  XCircle,
  Zap,
} from 'lucide-react';
import { useMemo, useRef } from 'react';
import { EXIT_INTERRUPTED_SENTINEL } from '../../electron/shared/exit-codes';
import { HeroBanner } from '../components/hero/HeroBanner';
import { PageSkeleton } from '../components/PageSkeleton';
import {
  Badge,
  EmptyState,
  ErrorPanel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui';
import { useHistoryContext } from '../contexts/HistoryContext';
import { useVirtualRows } from '../hooks/use-virtual-rows';
import { HERO_ART } from '../lib/hero-art';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

const HISTORY_ROW_HEIGHT = 57;

function HistoryRow({
  entry,
  index,
  rowRef,
}: {
  entry: {
    id: string;
    scriptName: string;
    trigger?: 'manual' | 'scheduled';
    startTime: string;
    durationMs: number;
    wasCancelled: boolean;
    exitCode: number | null;
  };
  index?: number;
  rowRef?: React.Ref<HTMLTableRowElement>;
}) {
  return (
    <TableRow data-index={index} ref={rowRef}>
      <TableCell className="font-medium">{entry.scriptName}</TableCell>
      <TableCell>
        {entry.trigger === 'scheduled' ? (
          <Badge variant="secondary" className="gap-1 text-primary bg-primary/10">
            <Clock className="size-3" /> Automática
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 text-primary bg-primary/10">
            <MousePointerClick className="size-3" /> Manual
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="size-3" />
          {formatDate(entry.startTime)}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {entry.wasCancelled ? '—' : formatDuration(entry.durationMs)}
      </TableCell>
      <TableCell>
        {entry.wasCancelled && (
          <Badge variant="secondary" className="gap-1 text-warning bg-warning/10">
            <XCircle className="size-3" /> Cancelado
          </Badge>
        )}
        {entry.exitCode === 0 && (
          <Badge variant="secondary" className="gap-1 text-success bg-success/10">
            <CheckCircle className="size-3" /> Sucesso
          </Badge>
        )}
        {entry.exitCode === EXIT_INTERRUPTED_SENTINEL && (
          <Badge
            variant="secondary"
            className="gap-1 text-warning bg-warning/10"
            title="O script pode ter concluído com sucesso antes de você fechar a janela. Verifique se o Spicetify foi instalado no Spotify."
          >
            <PauseCircle className="size-3" /> Interrompido pelo usuário
          </Badge>
        )}
        {entry.exitCode != null && entry.exitCode > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="size-3" /> Erro ({entry.exitCode})
          </Badge>
        )}
        {entry.exitCode != null &&
          entry.exitCode < 0 &&
          entry.exitCode !== EXIT_INTERRUPTED_SENTINEL && (
            <Badge variant="destructive" className="gap-1">
              <AlertOctagon className="size-3" /> Erro (spawn)
            </Badge>
          )}
        {entry.exitCode === null && !entry.wasCancelled && '—'}
      </TableCell>
    </TableRow>
  );
}

export default function HistoryPage() {
  const { state } = useHistoryContext();

  const history = state.status === 'success' ? state.data : [];

  // null = usa a rolagem da própria página (#main-content). O ref do corpo da
  // tabela é necessário para descontar a distância até o início da lista.
  const listRef = useRef<HTMLTableSectionElement>(null);
  const { virtualItems, paddingTop, paddingBottom, measureElement } = useVirtualRows(
    history,
    null,
    HISTORY_ROW_HEIGHT,
    listRef
  );

  const stats = useMemo(() => {
    if (state.status !== 'success') return null;
    const h = state.data;
    const success = h.filter((e) => e.exitCode === 0).length;
    const failed = h.filter(
      (e) =>
        e.exitCode != null &&
        e.exitCode !== 0 &&
        e.exitCode !== EXIT_INTERRUPTED_SENTINEL &&
        !e.wasCancelled
    ).length;
    const cancelled = h.filter((e) => e.wasCancelled).length;
    return { total: h.length, success, failed, cancelled };
  }, [state]);

  if (state.status === 'loading') {
    return <PageSkeleton layout="history" label="Carregando histórico…" />;
  }

  if (state.status === 'error') {
    return (
      <ErrorPanel
        title="Erro ao carregar histórico"
        message={state.error}
        className="gap-2 text-muted-foreground"
        icon={false}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <HeroBanner
        {...HERO_ART['/history']}
        badge="Histórico"
        path="/history"
        title="Histórico de Execuções"
        description="Acompanhe todas as execuções de tweaks realizadas no sistema."
      />

      {/* Stats Cards */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="size-3.5 text-primary" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Total</span>
            </div>
            <p className="text-xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle className="size-3.5 text-success" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                Sucesso
              </span>
            </div>
            <p className="text-xl font-bold text-success">{stats.success}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-destructive/10">
                <AlertOctagon className="size-3.5 text-destructive" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Erros</span>
            </div>
            <p className="text-xl font-bold text-destructive">{stats.failed}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-warning/10">
                <XCircle className="size-3.5 text-warning" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                Cancelados
              </span>
            </div>
            <p className="text-xl font-bold text-warning">{stats.cancelled}</p>
          </div>
        </div>
      )}

      {/* Histórico — rolagem da própria página */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="size-1.5 rounded-full bg-primary" />
          <h3 className="text-sm font-semibold text-foreground">Registros</h3>
        </div>

        {history.length === 0 ? (
          <EmptyState
            icon={<Clock className="size-8" />}
            title="Nenhuma execução registrada"
            description="Execute um script para vê-lo aqui"
          />
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <Table containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="bg-muted/30">
                  <TableHead>Tweak</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody ref={listRef}>
                {paddingTop > 0 && (
                  <tr style={{ height: paddingTop }}>
                    <td colSpan={5} />
                  </tr>
                )}
                {virtualItems.map((virtualRow) => {
                  const entry = history[virtualRow.index];
                  return (
                    <HistoryRow
                      key={entry.id}
                      entry={entry}
                      index={virtualRow.index}
                      rowRef={measureElement}
                    />
                  );
                })}
                {paddingBottom > 0 && (
                  <tr style={{ height: paddingBottom }}>
                    <td colSpan={5} />
                  </tr>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
