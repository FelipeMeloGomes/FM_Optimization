import {
  CircuitBoard,
  Cpu,
  Download,
  HardDrive,
  Layers3,
  Loader2,
  MemoryStick,
  Monitor,
  Server,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { formatMemoryTotal } from '@/utils/format';
import { DashboardWidget } from '../components/DashboardWidget';
import { AnimatedDashboard } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { Badge, Button, Skeleton } from '../components/ui';
import { useScriptExecutionContext } from '../contexts/ScriptExecutionContext';
import { useSystemContext } from '../contexts/SystemContext';

/** Script "Relatorios do Sistema", registrado no catalogo para a pagina Meu PC. */
const REPORT_SCRIPT_ID = 'util-3';

function SpecItem({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {Icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-foreground" title={value}>
          {value}
        </p>
        {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}

export default function MeuPcPage() {
  const { state, refreshing, refresh, hasFetched } = useSystemContext();
  const { execute, activeExecution } = useScriptExecutionContext();

  useEffect(() => {
    if (!hasFetched) refresh();
  }, [hasFetched, refresh]);

  if (state.status === 'loading') {
    return (
      <div className="space-y-6">
        <div className="h-32 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estaticos
            <Skeleton key={`skeleton-${i}`} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
        <p className="text-sm">Erro ao carregar as informacoes do computador</p>
        <p className="text-xs text-destructive">{state.error}</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const { cpu, gpu, memory, motherboard, caches, drives } = state.data;
  const cacheValues = [caches?.l1, caches?.l2, caches?.l3].filter(Boolean).join(' / ') || '—';
  const storageDetail = drives
    .map((drive) => `${drive.letter} ${drive.type || drive.fileSystem || ''}`.trim())
    .join(' · ');

  return (
    <div className="space-y-6">
      <HeroBanner visual={<AnimatedDashboard />}>
        <div className="relative p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Cpu className="size-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Sistema
                </span>
              </div>
              <h2 className="text-2xl font-bold text-foreground">Meu PC</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Tudo sobre o hardware deste computador, lido direto do Windows: processador, caches,
                placa-mae, memoria, placa de video e discos.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={refreshing}
                className="gap-1.5"
              >
                {refreshing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Server className="size-3.5" />
                )}
                {refreshing ? 'Atualizando…' : 'Atualizar'}
              </Button>
              <Button
                size="sm"
                onClick={() => void execute(REPORT_SCRIPT_ID)}
                disabled={activeExecution === REPORT_SCRIPT_ID}
                className="gap-1.5"
              >
                {activeExecution === REPORT_SCRIPT_ID ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                Exportar relatório...
              </Button>
            </div>
          </div>
        </div>
      </HeroBanner>

      {/* Componentes principais */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <div className="size-1.5 rounded-full bg-primary" />
          <h3 className="text-sm font-semibold text-foreground">Componentes</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardWidget
            icon={Cpu}
            label="Processador"
            value={cpu.model}
            detail={`${cpu.cores} núcleos · ${cpu.logicalProcessors} threads`}
          />
          <DashboardWidget
            icon={Monitor}
            label="Gráficos"
            value={gpu.name}
            detail={`${gpu.vram} VRAM · driver ${gpu.driverVersion}`}
          />
          <DashboardWidget
            icon={CircuitBoard}
            label="Placa-mãe"
            value={motherboard?.product || '—'}
            detail={`${motherboard?.manufacturer || '—'}${motherboard?.version && motherboard.version !== '—' ? ` · ${motherboard.version}` : ''}`}
          />
        </div>
      </div>

      {/* Memória e armazenamento */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <div className="size-1.5 rounded-full bg-success" />
          <h3 className="text-sm font-semibold text-foreground">Memória e armazenamento</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardWidget
            icon={MemoryStick}
            label="Memória"
            value={formatMemoryTotal(memory.total)}
            detail={`${memory.type} · ${memory.frequency} · ${memory.slotsUsed ?? memory.slots} de ${memory.slotsTotal ?? memory.slots} slots`}
          />
          <DashboardWidget
            icon={HardDrive}
            label="Armazenamento"
            value={`${drives.length} ${drives.length === 1 ? 'unidade' : 'unidades'}`}
            detail={storageDetail || 'Nenhuma unidade detectada'}
          />
          <DashboardWidget
            icon={Layers3}
            label="Caches"
            value={cacheValues}
            detail={`L1 / L2 / L3 · ${cpu.model}`}
          />
        </div>
      </div>

      {/* Itens do sistema */}
      <div data-testid="itens-do-sistema">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-warning" />
            <h3 className="text-sm font-semibold text-foreground">Itens do sistema</h3>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            7 itens
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SpecItem
            icon={<Cpu className="size-4" />}
            label="Processador"
            value={cpu.model}
            detail={`${cpu.cores} núcleos · ${cpu.logicalProcessors} threads`}
          />
          <SpecItem
            icon={<Layers3 className="size-4" />}
            label="Caches"
            value={cacheValues}
            detail="L1 / L2 / L3"
          />
          <SpecItem
            icon={<CircuitBoard className="size-4" />}
            label="Placa-mãe"
            value={motherboard?.product || '—'}
            detail={motherboard?.manufacturer}
          />
          <SpecItem
            icon={<MemoryStick className="size-4" />}
            label="Memória"
            value={formatMemoryTotal(memory.total)}
            detail={`${memory.type} · ${memory.frequency}`}
          />
          <SpecItem
            icon={<MemoryStick className="size-4" />}
            label="Slots de memória"
            value={`${memory.slotsUsed ?? memory.slots} de ${memory.slotsTotal ?? memory.slots}`}
            detail="slots ocupados"
          />
          <SpecItem
            icon={<Monitor className="size-4" />}
            label="Gráficos"
            value={gpu.name}
            detail={`${gpu.vram} VRAM`}
          />
          <SpecItem
            icon={<HardDrive className="size-4" />}
            label="Armazenamento"
            value={`${drives.length} ${drives.length === 1 ? 'unidade' : 'unidades'}`}
            detail={storageDetail || 'Nenhuma unidade detectada'}
          />
        </div>
      </div>
    </div>
  );
}
