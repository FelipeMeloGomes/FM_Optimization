import {
  AlertCircle,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AsyncState,
  GpuCatalogEntry,
  GpuCatalogResult,
} from '../../electron/shared/ipc-types';
import { AnimatedHero } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { RouteIcon } from '../components/hero/RouteIcon';
import { PageRefreshBar } from '../components/RefreshButton';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Progress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui';
import { useSystemContext } from '../contexts/SystemContext';
import { findUserGpu, normalizeGpuName } from '../lib/gpu-match';
import { cn } from '../lib/utils';

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function formatNumber(value: number | undefined, suffix = ''): string {
  return value === undefined ? '—' : `${numberFormat.format(value)}${suffix}`;
}

interface SpecRow {
  label: string;
  value: (gpu: GpuCatalogEntry) => string;
}

const SPEC_ROWS: SpecRow[] = [
  { label: 'Fabricante', value: (gpu) => gpu.manufacturer },
  { label: 'Arquitetura', value: (gpu) => gpu.architecture ?? '—' },
  { label: 'Nome do código', value: (gpu) => gpu.codename ?? '—' },
  { label: 'Memória VRAM', value: (gpu) => formatNumber(gpu.vramGb, ' GB') },
  { label: 'Tipo de memória', value: (gpu) => gpu.vramType ?? '—' },
  { label: 'Barramento', value: (gpu) => formatNumber(gpu.memoryBusBits, ' bits') },
  {
    label: 'Largura de banda',
    value: (gpu) => formatNumber(gpu.memoryBandwidthGbps, ' GB/s'),
  },
  { label: 'TDP', value: (gpu) => formatNumber(gpu.tdpWatts, ' W') },
  { label: 'Boost', value: (gpu) => formatNumber(gpu.boostClockMhz, ' MHz') },
  { label: 'Processadores de sombreamento', value: (gpu) => formatNumber(gpu.shaderCount) },
  { label: 'Processo de fabricação', value: (gpu) => formatNumber(gpu.processNm, ' nm') },
  { label: 'Ano de lançamento', value: (gpu) => formatNumber(gpu.releaseYear) },
];

function GpuPicker({
  id,
  label,
  gpus,
  value,
  onChange,
  yourGpuId,
}: {
  id: string;
  label: string;
  gpus: GpuCatalogEntry[];
  value: string;
  onChange: (id: string) => void;
  yourGpuId?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = gpus.find((gpu) => gpu.id === value);

  const filtered = useMemo(() => {
    const term = normalizeGpuName(query);
    if (!term) return gpus;
    return gpus.filter((gpu) => normalizeGpuName(gpu.name).includes(term));
  }, [gpus, query]);

  const choose = (gpu: GpuCatalogEntry) => {
    onChange(gpu.id);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActive((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && filtered[active]) {
      event.preventDefault();
      choose(filtered[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div className="relative space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filtered[active] ? `${id}-option-${filtered[active].id}` : undefined
          }
          autoComplete="off"
          value={open ? query : (selected?.name ?? '')}
          placeholder="Buscar placa…"
          onFocus={() => {
            setQuery('');
            setActive(0);
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onBlur={(event) => {
            if (!event.currentTarget.parentElement?.parentElement?.contains(event.relatedTarget)) {
              setOpen(false);
            }
          }}
          className="h-11 w-full rounded-md border border-border bg-background pr-10 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50"
        />
        <button
          type="button"
          aria-label={open ? 'Fechar busca' : 'Abrir busca'}
          onClick={() => {
            setOpen((value) => !value);
            setQuery('');
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {open ? <X className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>
      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nenhuma placa encontrada</p>
          ) : (
            filtered.map((gpu, index) => (
              <button
                key={gpu.id}
                id={`${id}-option-${gpu.id}`}
                type="button"
                role="option"
                aria-selected={gpu.id === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(gpu)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                  index === active && 'bg-accent'
                )}
              >
                <span className="truncate">{gpu.name}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {gpu.id === yourGpuId && (
                    <span className="text-[10px] font-semibold tracking-wide text-primary uppercase">
                      Sua
                    </span>
                  )}
                  {gpu.id === value && <Check className="size-4 text-primary" />}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ContenderCard({
  gpu,
  percent,
  isYours,
  isFaster,
  side,
}: {
  gpu: GpuCatalogEntry;
  percent: number;
  isYours: boolean;
  isFaster: boolean;
  side: 'A' | 'B';
}) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-colors',
        isFaster && 'border-primary/40 bg-primary/5'
      )}
    >
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded border border-border bg-muted text-[10px] font-bold text-muted-foreground">
            {side}
          </span>
          <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {isYours ? 'Sua placa' : side === 'A' ? 'Placa A' : 'Placa B'}
          </span>
          {isYours && (
            <Badge className="ml-auto gap-1 border-primary/30 bg-primary/10 text-primary">
              <Sparkles className="size-3" />
              Detectada
            </Badge>
          )}
          {isFaster && !isYours && (
            <Badge className="ml-auto border-primary/30 bg-primary/10 text-primary">
              Mais rápida
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg leading-tight" title={gpu.name}>
          {gpu.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              PassMark
            </p>
            <p className="mt-0.5 text-3xl font-bold tabular-nums text-foreground">
              {numberFormat.format(gpu.performanceScore)}
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-primary">
            {formatNumber(percent)}%
          </span>
        </div>
        <Progress value={percent} ariaLabel={`Desempenho de ${gpu.name}`} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {gpu.manufacturer} · {formatNumber(gpu.vramGb, ' GB')} de VRAM
        </p>
      </CardContent>
    </Card>
  );
}

function PageContent({ children }: { children: ReactNode }) {
  return <div className="relative p-6">{children}</div>;
}

export default function CompararPlacaPage() {
  const [state, setState] = useState<AsyncState<GpuCatalogResult>>({ status: 'loading' });
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const [yourGpuId, setYourGpuId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const searchedFor = useRef<string | null>(null);

  const { state: systemState } = useSystemContext();
  const systemGpuName = systemState.status === 'success' ? systemState.data.gpu.name : undefined;
  const systemNameRef = useRef<string | undefined>(undefined);

  // Declarado antes do efeito de carga: o `load` lê o ref e precisa do nome
  // mais recente já sincronizado quando o catálogo é buscado na montagem.
  useEffect(() => {
    systemNameRef.current = systemGpuName;
  }, [systemGpuName]);

  const applyUserGpu = useCallback(
    async (data: GpuCatalogResult, name: string | undefined): Promise<void> => {
      let result = data;
      let match = name ? findUserGpu(result.gpus, name) : undefined;
      if (name) searchedFor.current = name;

      if (!match && name) {
        setSearching(true);
        try {
          const found = await window.electronAPI.searchGpu(name);
          if (found) {
            result = {
              ...result,
              gpus: [found, ...result.gpus.filter((gpu) => gpu.id !== found.id)],
            };
            match = found;
            setNotice(`${found.name} foi encontrada online e entrou na comparação.`);
          } else {
            setNotice(`Sua placa (${name}) não está no catálogo. Escolha uma placa para comparar.`);
          }
        } finally {
          setSearching(false);
        }
      }

      setState({ status: 'success', data: result });
      setYourGpuId(match?.id ?? null);
      setLeftId((current) =>
        current && result.gpus.some((gpu) => gpu.id === current)
          ? current
          : (match?.id ?? result.gpus[0]?.id ?? null)
      );
      setRightId((current) =>
        current && result.gpus.some((gpu) => gpu.id === current)
          ? current
          : (result.gpus.find((gpu) => gpu.id !== (match?.id ?? result.gpus[0]?.id))?.id ??
            result.gpus[0]?.id ??
            null)
      );
    },
    []
  );

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setNotice(null);
    try {
      const data = await window.electronAPI.getGpuCatalog();
      await applyUserGpu(data, systemNameRef.current);
    } catch (error) {
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [applyUserGpu]);

  useEffect(() => {
    void load();
  }, [load]);

  // O SystemProvider pode terminar de carregar depois do catálogo.
  useEffect(() => {
    if (state.status !== 'success' || !systemGpuName) return;
    if (searchedFor.current === systemGpuName) return;
    void applyUserGpu(state.data, systemGpuName);
  }, [state, systemGpuName, applyUserGpu]);

  const gpus = state.status === 'success' ? state.data.gpus : [];
  const left = gpus.find((gpu) => gpu.id === leftId) ?? gpus[0];
  const right = gpus.find((gpu) => gpu.id === rightId) ?? gpus[1] ?? gpus[0];
  const maxScore = Math.max(left?.performanceScore ?? 0, right?.performanceScore ?? 0, 1);
  const faster =
    left && right && left.id !== right.id && left.performanceScore !== right.performanceScore
      ? left.performanceScore > right.performanceScore
        ? left
        : right
      : undefined;
  const slower = faster === left ? right : left;
  const delta =
    faster && slower
      ? ((faster.performanceScore - slower.performanceScore) /
          Math.max(slower.performanceScore, 1)) *
        100
      : 0;

  const changeLeft = (id: string) => setLeftId(id);
  const changeRight = (id: string) => setRightId(id);

  return (
    <div className="space-y-6">
      <HeroBanner visual={<AnimatedHero path="/comparar-placa" animation="scan" />}>
        <PageContent>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <RouteIcon path="/comparar-placa" />
                <span className="text-xs font-semibold tracking-wider text-primary uppercase">
                  Ferramentas
                </span>
              </div>
              <h2 className="text-2xl font-bold text-foreground">Comparar Placas</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Sua placa aparece primeiro. Busque outra para ver a diferença de desempenho e as
                especificações lado a lado.
              </p>
              {systemGpuName && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="size-3" />
                  Detectada: {systemGpuName}
                </p>
              )}
            </div>
          </div>
        </PageContent>
      </HeroBanner>

      {state.status === 'success' && (
        <PageRefreshBar onRefresh={() => void load()} label="Recarregar catálogo" />
      )}

      {state.status === 'loading' && (
        <div className="space-y-4" role="status" aria-live="polite">
          <p className="text-sm text-muted-foreground">
            {searching
              ? 'Buscando sua placa na internet…'
              : 'Carregando catálogo de placas de vídeo…'}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"
        >
          <AlertCircle className="size-6 text-destructive" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Não foi possível carregar o catálogo
            </p>
            <p className="mt-1 text-xs text-destructive">{state.error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {state.status === 'success' && left && right && (
        <>
          {state.data.isFromCache && (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
              Dados em cache: não foi possível atualizar o catálogo agora.
            </div>
          )}
          {notice && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-xs text-primary">
              {notice}
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Escolha as placas</CardTitle>
              <p className="text-xs text-muted-foreground">
                Digite para buscar pelo nome — a lista filtra enquanto você escreve.
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <GpuPicker
                id="gpu-a"
                label="Placa A"
                gpus={gpus}
                value={left.id}
                onChange={changeLeft}
                yourGpuId={yourGpuId ?? undefined}
              />
              <GpuPicker
                id="gpu-b"
                label="Placa B"
                gpus={gpus}
                value={right.id}
                onChange={changeRight}
                yourGpuId={yourGpuId ?? undefined}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
            <ContenderCard
              gpu={left}
              percent={(left.performanceScore / maxScore) * 100}
              isYours={left.id === yourGpuId}
              isFaster={faster === left}
              side="A"
            />
            <div className="flex items-center justify-center">
              <span className="flex size-9 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-bold tracking-wider text-muted-foreground">
                VS
              </span>
            </div>
            <ContenderCard
              gpu={right}
              percent={(right.performanceScore / maxScore) * 100}
              isYours={right.id === yourGpuId}
              isFaster={faster === right}
              side="B"
            />
          </div>

          {faster && slower && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
              <span className="font-semibold tabular-nums text-primary">
                {formatNumber(delta)}%
              </span>{' '}
              de diferença a favor de {faster.name} sobre {slower.name}.
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Especificações lado a lado</CardTitle>
            </CardHeader>
            <CardContent>
              <Table containerClassName="overflow-visible">
                <TableHeader>
                  <TableRow>
                    <TableHead>Especificação</TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1.5">
                        Placa A
                        {left.id === yourGpuId && (
                          <span className="text-[10px] font-semibold text-primary uppercase">
                            Sua
                          </span>
                        )}
                      </span>
                    </TableHead>
                    <TableHead>Placa B</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SPEC_ROWS.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="font-medium text-muted-foreground">
                        {row.label}
                      </TableCell>
                      <TableCell>{row.value(left)}</TableCell>
                      <TableCell>{row.value(right)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-medium text-muted-foreground">
                      Pontuação PassMark
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {numberFormat.format(left.performanceScore)}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {numberFormat.format(right.performanceScore)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            Fonte: {state.data.source}
            <a
              href={state.data.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              abrir site de origem <ExternalLink className="size-3" />
            </a>
            <span className="ml-auto inline-flex items-center gap-1">
              <Loader2 className="size-3" />
              Atualizado em {new Date(state.data.updatedAt).toLocaleDateString('pt-BR')}
            </span>
          </p>
        </>
      )}
    </div>
  );
}
