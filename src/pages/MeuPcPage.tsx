import {
  AppWindow,
  ChevronLeft,
  ChevronRight,
  CircuitBoard,
  Clock,
  Cpu,
  Download,
  HardDrive,
  Layers3,
  Loader2,
  MemoryStick,
  Monitor,
} from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { formatMemoryTotal } from '@/utils/format';
import { DashboardWidget } from '../components/DashboardWidget';
import { HeroBanner } from '../components/hero/HeroBanner';
import { PageSkeleton } from '../components/PageSkeleton';
import { PageRefreshBar } from '../components/RefreshButton';
import { Badge, Button } from '../components/ui';
import { useScriptExecutionContext } from '../contexts/ScriptExecutionContext';
import { useSystemContext } from '../contexts/SystemContext';
import { HERO_ART } from '../lib/hero-art';

/** Script "Relatorios do Sistema", registrado no catalogo para a pagina Meu PC. */
const REPORT_SCRIPT_ID = 'util-3';

const UNAVAILABLE = '—';

interface DetailRow {
  label: string;
  value: string;
}

interface DetailSection {
  title?: string;
  rows: DetailRow[];
}

function formatBoolean(value?: boolean): string {
  if (value === undefined) return UNAVAILABLE;
  return value ? 'Sim' : 'Não';
}

function availableOr(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed !== UNAVAILABLE ? trimmed : fallback;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const parts = [
    days > 0 && `${days} d`,
    hours > 0 && `${hours} h`,
    minutes > 0 && `${minutes} min`,
    remainingSeconds > 0 && `${remainingSeconds} s`,
  ].filter(Boolean);
  return parts.join(' ') || '0 s';
}

function formatInstallDate(value?: string): string {
  if (!value) return UNAVAILABLE;
  const wmiDate = /^\/Date\((\d+)\)\/?$/.exec(value);
  const date = new Date(wmiDate ? Number(wmiDate[1]) : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
}

interface SystemItem {
  id: string;
  label: string;
  icon: ReactNode;
  summary: string;
  sections: DetailSection[];
}

function ItemPanel({ item, id, labelledBy }: { item: SystemItem; id: string; labelledBy: string }) {
  return (
    <section
      id={id}
      role="tabpanel"
      aria-labelledby={labelledBy}
      className="mt-3 rounded-xl border border-border bg-background p-4 sm:p-5"
    >
      <div className="mb-4 flex items-start gap-3 border-b border-border pb-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {item.icon}
        </div>
        <div className="min-w-0">
          <h4 className="text-base font-semibold text-foreground">{item.label}</h4>
          <p className="break-words text-xs text-muted-foreground">{item.summary}</p>
        </div>
      </div>
      <div className="divide-y divide-border/70">
        {item.sections.map((section, sectionIndex) => (
          <div key={section.title ?? sectionIndex} className="py-1 first:pt-0 last:pb-0">
            {section.title && (
              <p className="pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {section.title}
              </p>
            )}
            <dl>
              {section.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-4 py-2 text-sm"
                >
                  <dt className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="min-w-0 break-words text-right text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

const TAB_LABEL_VARIANTS = {
  hidden: { opacity: 0, y: 6, filter: 'blur(5px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
} as const;

/** Rótulo de aba com a mesma entrada em cascata dos componentes React Bits. */
function AnimatedTabLabel({ text, index }: { text: string; index: number }) {
  const words = text.split(' ');

  return (
    <motion.span
      data-tab-label
      className="inline-flex gap-1"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.05, delayChildren: Math.min(index * 0.03, 0.2) },
        },
      }}
    >
      {words.map((word) => (
        <motion.span
          key={`${text}-${word}`}
          aria-hidden="true"
          className="inline-block will-change-[transform,filter,opacity]"
          variants={TAB_LABEL_VARIANTS}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] as const }}
        >
          {word}
        </motion.span>
      ))}
      <span className="sr-only select-none">{text}</span>
    </motion.span>
  );
}

export default function MeuPcPage() {
  const { state, refreshing, refresh, hasFetched } = useSystemContext();
  const { execute, activeExecution } = useScriptExecutionContext();
  const baseId = useId();
  const [activeId, setActiveId] = useState('processador');
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasFetched) refresh();
  }, [hasFetched, refresh]);

  useEffect(() => {
    const tab = stripRef.current?.querySelector<HTMLButtonElement>(`[data-item-id="${activeId}"]`);
    tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  if (state.status === 'loading') {
    return <PageSkeleton layout="meu-pc" label="Carregando informações do computador…" />;
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

  const { cpu, gpu, memory, motherboard, caches, drives, os, uptime } = state.data;
  const cacheValues = [caches?.l1, caches?.l2, caches?.l3].filter(Boolean).join(' / ') || '—';
  const storageDetail = drives
    .map((drive) => `${drive.letter} ${drive.type || drive.fileSystem || ''}`.trim())
    .join(' · ');
  const slotsUsed = memory.slotsUsed ?? memory.slots;
  const slotsTotal = memory.slotsTotal ?? memory.slots;

  const processorSections: DetailSection[] = [
    {
      rows: [
        { label: 'Modelo', value: cpu.model },
        { label: 'Nome original', value: cpu.rawModel || UNAVAILABLE },
        { label: 'Fabricante', value: cpu.manufacturer || UNAVAILABLE },
        { label: 'Vendor', value: cpu.vendor || UNAVAILABLE },
        {
          label: 'Núcleos físicos',
          value: `${cpu.cores}${cpu.coresEstimated ? ' (estimado)' : ''}`,
        },
        { label: 'Processadores lógicos', value: String(cpu.logicalProcessors) },
        { label: 'Arquitetura', value: cpu.architecture || UNAVAILABLE },
        { label: 'Uso atual', value: `${cpu.usage}%` },
        { label: 'Família', value: cpu.family || UNAVAILABLE },
        { label: 'Número do modelo', value: cpu.modelNumber || UNAVAILABLE },
        { label: 'Stepping', value: cpu.stepping || UNAVAILABLE },
        {
          label: 'Clock máximo',
          value: cpu.maxClockMhz ? `${cpu.maxClockMhz} MHz` : UNAVAILABLE,
        },
        { label: 'Origem do nome', value: cpu.nameSource || UNAVAILABLE },
        { label: 'Nome genérico', value: formatBoolean(cpu.nameIsGeneric) },
      ],
    },
  ];
  const cacheSections: DetailSection[] = [
    {
      rows: [
        { label: 'Cache L1', value: caches?.l1 || UNAVAILABLE },
        { label: 'Cache L2', value: caches?.l2 || UNAVAILABLE },
        { label: 'Cache L3', value: caches?.l3 || UNAVAILABLE },
      ],
    },
  ];
  const motherboardSections: DetailSection[] = [
    {
      rows: [
        {
          label: 'Fabricante',
          value: availableOr(motherboard?.manufacturer, 'Não informado'),
        },
        { label: 'Produto', value: availableOr(motherboard?.product, 'Não informado') },
        { label: 'Versão', value: availableOr(motherboard?.version, 'Não informada') },
        { label: 'Versão da BIOS', value: availableOr(motherboard?.biosVersion, 'Não informada') },
        {
          label: 'Data da BIOS',
          value: availableOr(motherboard?.biosReleaseDate, 'Não informada'),
        },
      ],
    },
  ];
  const memorySections: DetailSection[] = [
    {
      rows: [
        { label: 'Total', value: formatMemoryTotal(memory.total) },
        { label: 'Em uso', value: memory.used || UNAVAILABLE },
        { label: 'Livre', value: memory.free || UNAVAILABLE },
        { label: 'Tipo', value: memory.type || UNAVAILABLE },
        { label: 'Frequência', value: memory.frequency || UNAVAILABLE },
        { label: 'Slots ocupados', value: String(slotsUsed) },
        { label: 'Slots totais', value: String(slotsTotal) },
        { label: 'Módulos detectados', value: String(memory.slots) },
      ],
    },
  ];
  const memorySlotsSections: DetailSection[] = [
    {
      rows: [
        { label: 'Slots ocupados', value: String(slotsUsed) },
        { label: 'Slots totais', value: String(slotsTotal) },
        { label: 'Módulos detectados', value: String(memory.slots) },
      ],
    },
  ];
  const gpuSections: DetailSection[] = [
    {
      rows: [
        { label: 'Nome', value: gpu.name },
        { label: 'Nome original', value: gpu.rawName || UNAVAILABLE },
        { label: 'VRAM', value: gpu.vram || UNAVAILABLE },
        { label: 'Versão do driver', value: gpu.driverVersion || UNAVAILABLE },
        { label: 'Uso atual', value: `${gpu.usage}%` },
      ],
    },
  ];
  const storageSections: DetailSection[] = drives.length
    ? drives.map((drive) => ({
        title: `${drive.letter} ${drive.label}`.trim(),
        rows: [
          { label: 'Letra', value: drive.letter },
          { label: 'Rótulo', value: availableOr(drive.label, 'Sem rótulo') },
          { label: 'Tamanho', value: drive.size || UNAVAILABLE },
          { label: 'Livre', value: drive.free || UNAVAILABLE },
          { label: 'Espaço usado', value: `${drive.usedPercent}%` },
          { label: 'Tipo', value: drive.type || UNAVAILABLE },
          { label: 'Sistema de arquivos', value: drive.fileSystem || UNAVAILABLE },
        ],
      }))
    : [{ rows: [{ label: 'Unidades', value: 'Nenhuma unidade detectada' }] }];
  const osSections: DetailSection[] = [
    {
      rows: [
        { label: 'Nome', value: os.name || UNAVAILABLE },
        { label: 'Versão', value: os.version || UNAVAILABLE },
        { label: 'Build', value: os.build || UNAVAILABLE },
        { label: 'Edição', value: os.edition || UNAVAILABLE },
        { label: 'Data de instalação', value: formatInstallDate(os.installDate) },
      ],
    },
  ];
  const uptimeSections: DetailSection[] = [
    {
      rows: [
        { label: 'Total em segundos', value: String(uptime) },
        { label: 'Dias', value: String(Math.floor(uptime / 86400)) },
        { label: 'Horas', value: String(Math.floor((uptime % 86400) / 3600)) },
        { label: 'Minutos', value: String(Math.floor((uptime % 3600) / 60)) },
        { label: 'Segundos', value: String(uptime % 60) },
      ],
    },
  ];

  const items: SystemItem[] = [
    {
      id: 'processador',
      label: 'Processador',
      icon: <Cpu className="size-4" />,
      summary: `${cpu.model} · ${cpu.cores} núcleos · ${cpu.logicalProcessors} threads`,
      sections: processorSections,
    },
    {
      id: 'caches',
      label: 'Caches',
      icon: <Layers3 className="size-4" />,
      summary: `${cacheValues} · L1 / L2 / L3`,
      sections: cacheSections,
    },
    {
      id: 'placa-mae',
      label: 'Placa-mãe',
      icon: <CircuitBoard className="size-4" />,
      summary: `${motherboard?.manufacturer || UNAVAILABLE} · ${motherboard?.product || UNAVAILABLE}`,
      sections: motherboardSections,
    },
    {
      id: 'memoria',
      label: 'Memória',
      icon: <MemoryStick className="size-4" />,
      summary: `${formatMemoryTotal(memory.total)} · ${memory.type} · ${memory.frequency}`,
      sections: memorySections,
    },
    {
      id: 'slots',
      label: 'Slots de memória',
      icon: <MemoryStick className="size-4" />,
      summary: `${slotsUsed} de ${slotsTotal} ocupados`,
      sections: memorySlotsSections,
    },
    {
      id: 'graficos',
      label: 'Placa de vídeo',
      icon: <Monitor className="size-4" />,
      summary: `${gpu.name} · ${gpu.vram} VRAM`,
      sections: gpuSections,
    },
    {
      id: 'armazenamento',
      label: 'Armazenamento',
      icon: <HardDrive className="size-4" />,
      summary: `${drives.length} ${drives.length === 1 ? 'unidade' : 'unidades'}`,
      sections: storageSections,
    },
    {
      id: 'sistema-operacional',
      label: 'Sistema operacional',
      icon: <AppWindow className="size-4" />,
      summary: `${os.version} · build ${os.build} · ${os.edition}`,
      sections: osSections,
    },
    {
      id: 'tempo-de-atividade',
      label: 'Tempo de atividade',
      icon: <Clock className="size-4" />,
      summary: formatUptime(uptime),
      sections: uptimeSections,
    },
  ];

  const activeItem = items.find((item) => item.id === activeId) ?? items[0];
  const panelId = `${baseId}-panel`;
  const tabId = (id: string) => `${baseId}-tab-${id}`;

  const scrollStrip = (direction: -1 | 1) => {
    stripRef.current?.scrollBy({ left: direction * 240, behavior: 'smooth' });
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % items.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = items.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setActiveId(items[nextIndex].id);
    stripRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  };

  return (
    <div className="space-y-6">
      <HeroBanner
        badge="Sistema"
        path="/meu-pc"
        title="Meu PC"
        description="Tudo sobre o hardware deste computador, lido direto do Windows: processador, caches, placa-mãe, memória, placa de vídeo e discos."
        {...HERO_ART['/meu-pc']}
      />

      <PageRefreshBar onRefresh={refresh} refreshing={refreshing}>
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
      </PageRefreshBar>

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
            status="accent"
          />
          <DashboardWidget
            icon={Monitor}
            label="Placa de vídeo"
            value={gpu.name}
            detail={`${gpu.vram} VRAM · driver ${gpu.driverVersion}`}
            status="accent"
          />
          <DashboardWidget
            icon={CircuitBoard}
            label="Placa-mãe"
            value={motherboard?.product || '—'}
            detail={`${motherboard?.manufacturer || '—'}${motherboard?.version && motherboard.version !== '—' ? ` · ${motherboard.version}` : ''}`}
            status="accent"
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
            status="accent"
          />
          <DashboardWidget
            icon={HardDrive}
            label="Armazenamento"
            value={`${drives.length} ${drives.length === 1 ? 'unidade' : 'unidades'}`}
            detail={storageDetail || 'Nenhuma unidade detectada'}
            status="accent"
          />
          <DashboardWidget
            icon={Layers3}
            label="Caches"
            value={cacheValues}
            detail={`L1 / L2 / L3 · ${cpu.model}`}
            status="accent"
          />
        </div>
      </div>

      {/* Itens do sistema */}
      <MotionConfig reducedMotion="user">
        <div data-testid="itens-do-sistema">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-warning" />
              <h3 className="text-sm font-semibold text-foreground">Itens do sistema</h3>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              9 itens
            </Badge>
          </div>
          <div className="relative">
            <button
              type="button"
              aria-label="Rolar para a esquerda"
              onClick={() => scrollStrip(-1)}
              className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/95 p-1 text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <div
              ref={stripRef}
              role="tablist"
              aria-label="Itens do sistema"
              aria-orientation="horizontal"
              className="flex gap-1.5 overflow-x-auto rounded-full border border-border bg-muted/30 px-9 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {items.map((item, index) => {
                const selected = item.id === activeItem.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={tabId(item.id)}
                    data-item-id={item.id}
                    aria-selected={selected}
                    aria-controls={panelId}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveId(item.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${
                      selected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-background hover:text-foreground'
                    }`}
                  >
                    <AnimatedTabLabel text={item.label} index={index} />
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Rolar para a direita"
              onClick={() => scrollStrip(1)}
              className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/95 p-1 text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
          <motion.div
            key={activeItem.id}
            data-panel-animation
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }}
          >
            <ItemPanel item={activeItem} id={panelId} labelledBy={tabId(activeItem.id)} />
          </motion.div>
        </div>
      </MotionConfig>
    </div>
  );
}
