import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui';

export const PAGE_SKELETON_LAYOUTS = [
  'tweaks',
  'list',
  'dashboard',
  'meu-pc',
  'history',
  'restore',
  'startup',
  'device',
  'cards',
  'comparison',
  'analysis',
  'settings',
  'overlay',
  'minimal',
  'dns',
  'emulators',
  'settings-page',
] as const;

export type PageSkeletonLayout = (typeof PAGE_SKELETON_LAYOUTS)[number];
type HeroVariant = 'banner' | 'photo' | 'none';

export interface PageSkeletonProps {
  /** Formato da página carregada. Cada receita replica os containers reais. */
  layout: PageSkeletonLayout;
  /** Linhas, cards ou áreas. Quando ausente, usa a quantidade da página. */
  count?: number;
  /** Colunas da grade de cards; `1` empilha os cards. */
  columns?: number;
  /** Substitui o hero padrão da receita. */
  hero?: HeroVariant;
  /** Mostra o painel de ajustes no layout `device` quando a página tem um. */
  settings?: boolean;
  /** Texto anunciado enquanto o conteúdo carrega. */
  label?: string;
  className?: string;
}

const DEFAULT_COUNTS: Record<PageSkeletonLayout, number> = {
  tweaks: 4,
  list: 6,
  dashboard: 3,
  'meu-pc': 3,
  history: 6,
  restore: 4,
  startup: 3,
  device: 1,
  cards: 3,
  comparison: 4,
  analysis: 6,
  settings: 4,
  overlay: 2,
  minimal: 3,
  dns: 20,
  emulators: 2,
  'settings-page': 6,
};

const NO_HERO: ReadonlySet<PageSkeletonLayout> = new Set([
  'comparison',
  'analysis',
  'settings',
  'overlay',
  'dns',
  'emulators',
  'settings-page',
]);

function Bar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={className} {...props} />;
}

function Hero({ variant }: { variant: Exclude<HeroVariant, 'none'> }) {
  return variant === 'photo' ? (
    <div
      data-skeleton="hero-photo"
      className="h-56 overflow-hidden rounded-xl border border-border bg-muted animate-pulse"
    />
  ) : (
    <div data-skeleton="hero" className="h-32 rounded-xl bg-muted animate-pulse" />
  );
}

function MaybeHero({ variant, children }: { variant: HeroVariant; children?: ReactNode }) {
  if (variant === 'none') return null;
  if (variant === 'photo') return <Hero variant="photo" />;
  return children ?? <Hero variant="banner" />;
}

function Refresh() {
  return (
    <div
      data-skeleton="refresh"
      className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
    >
      <Bar className="h-4 w-32" />
      <Bar className="h-8 w-8 rounded-md" />
    </div>
  );
}

function Toolbar() {
  return (
    <div
      data-skeleton="toolbar"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
    >
      <Bar className="h-4 w-40" />
      <Bar className="h-8 w-24 rounded-md" />
    </div>
  );
}

function Rows({ count, checkbox = true }: { count: number; checkbox?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {Array.from({ length: count }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos, ordem fixa
          <li key={index} data-skeleton="row" className="flex h-[69px] items-center gap-3 px-4">
            {checkbox ? (
              <span className="size-4 shrink-0 rounded border border-border bg-muted" />
            ) : null}
            <Bar className="size-8 shrink-0 rounded-lg" />
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <Bar className="h-3 w-1/2" />
              <Bar className="h-2.5 w-1/3" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TableLike({ headers, count }: { headers: number; count: number }) {
  return (
    <div data-skeleton="table" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-6 border-b border-border bg-muted/30 px-4 py-3">
        {Array.from({ length: headers }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos, ordem fixa
          <Bar key={index} data-skeleton="column" className="h-3 w-16" />
        ))}
      </div>
      <ul className="divide-y divide-border">
        {Array.from({ length: count }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos, ordem fixa
          <li key={index} data-skeleton="row" className="flex h-14 items-center gap-6 px-4">
            <Bar className="size-8 shrink-0 rounded-lg" />
            <Bar className="h-3 w-1/4" />
            <Bar className="h-3 w-1/5" />
            <Bar className="h-3 w-1/6" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ children }: { children: ReactNode }) {
  return (
    <div data-skeleton="section" className="space-y-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-primary" />
        <Bar className="h-3 w-24" />
      </div>
      {children}
    </div>
  );
}

function CardGrid({
  count,
  columns,
  stacked = false,
}: {
  count: number;
  columns: number;
  stacked?: boolean;
}) {
  const cards = Array.from({ length: count }).map((_, index) => (
    <div
      // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos, ordem fixa
      key={index}
      data-skeleton="card"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <Bar className="h-4 w-1/3" />
      <Bar className="h-6 w-2/3" />
      <Bar className="h-3 w-1/2" />
    </div>
  ));

  if (stacked) return <div className="flex flex-col gap-4">{cards}</div>;

  return (
    <div
      data-skeleton="grid"
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2',
        columns >= 3 && 'lg:grid-cols-3',
        columns >= 4 && 'xl:grid-cols-4'
      )}
    >
      {cards}
    </div>
  );
}

function Stats({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos, ordem fixa
          key={index}
          data-skeleton="stat"
          className="rounded-xl border border-border bg-card p-4"
        >
          <Bar className="mb-2 h-4 w-1/2" />
          <Bar className="h-6 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function Form() {
  return (
    <div
      data-skeleton="form"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row"
    >
      <Bar className="h-9 flex-1 rounded-md" />
      <Bar className="h-9 w-24 rounded-md" />
    </div>
  );
}

function Footer() {
  return (
    <div
      data-skeleton="footer"
      className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
    >
      <Bar className="h-4 w-32" />
      <Bar className="h-5 w-36 rounded-full" />
    </div>
  );
}

function SettingsPanel() {
  return (
    <div data-skeleton="settings" className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <Bar className="h-4 w-48" />
        <Bar className="h-5 w-16 rounded-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,38%)_minmax(0,1fr)]">
        <div data-skeleton="preview" className="h-48 rounded-lg bg-muted animate-pulse" />
        <div data-skeleton="controls" className="flex flex-col gap-4">
          <Bar className="h-16 rounded-lg" />
          <Bar className="h-16 rounded-lg" />
          <Bar className="h-16 rounded-lg" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos, ordem fixa
          <Bar key={index} data-skeleton="action" className="h-9 w-24 rounded-md" />
        ))}
      </div>
    </div>
  );
}

function StartupHero() {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <Bar className="h-5 w-1/3" />
      <div className="grid max-w-xl grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos, ordem fixa
            key={index}
            data-skeleton="hero-stat"
            className="flex flex-col gap-2 rounded-lg bg-muted p-3 animate-pulse"
          >
            <Bar className="h-3 w-2/3" />
            <Bar className="h-5 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Tabs() {
  return (
    <div className="flex gap-2">
      {Array.from({ length: 3 }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos, ordem fixa
        <Bar key={index} data-skeleton="tab" className="h-9 w-24 rounded-md" />
      ))}
    </div>
  );
}

function Comparison() {
  return (
    <div className="space-y-4">
      <Refresh />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Bar data-skeleton="picker" className="h-40 rounded-xl" />
        <Bar data-skeleton="picker" className="h-40 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
        <Bar className="h-48 rounded-xl" />
        <div
          data-skeleton="versus"
          className="flex size-9 items-center justify-center rounded-full border border-border bg-muted"
        />
        <Bar className="h-48 rounded-xl" />
      </div>
      <Section>
        <TableLike headers={8} count={4} />
      </Section>
    </div>
  );
}

function Analysis({ count }: { count: number }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div
          data-skeleton="score"
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
        >
          <Bar className="h-4 w-1/2" />
          <Bar className="h-10 w-2/3" />
          <Bar className="h-3 w-full" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 md:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos, ordem fixa
                key={index}
                data-skeleton="area"
                className="flex h-24 flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 animate-pulse"
              >
                <Bar className="h-3 w-2/3" />
                <Bar className="h-2 w-full" />
                <Bar className="h-2 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <Toolbar />
      <Rows count={3} />
    </div>
  );
}

function DnsSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-4">
      <div data-skeleton="dns-status" className="rounded-xl border border-primary/20 bg-card p-4">
        <div className="flex items-center gap-3">
          <Bar className="size-9 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Bar className="h-3 w-28" />
            <Bar className="h-4 w-44" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Bar className="h-3 w-20" />
            <Bar className="h-4 w-32" />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: count }, (_, index) => `dns-provider-${index}`).map((key) => (
          <div
            key={key}
            data-skeleton="dns-provider"
            className="flex h-[60px] items-center gap-3 rounded-xl border border-border bg-card px-3"
          >
            <Bar className="size-9 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Bar className="h-3 w-1/4" />
              <Bar className="h-2.5 w-1/2" />
            </div>
            <Bar className="h-7 w-16 rounded-md" />
            <Bar className="h-8 w-[70px] rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AdbStatus() {
  return (
    <div data-skeleton="adb-status" className="rounded-xl border border-primary/20 bg-card p-4">
      <div className="flex items-center gap-3">
        <Bar className="size-9 shrink-0 rounded-lg" />
        <div className="flex flex-1 flex-col gap-2">
          <Bar className="h-3 w-24" />
          <Bar className="h-4 w-56" />
        </div>
        <Bar className="size-8 rounded-md" />
      </div>
    </div>
  );
}

function SettingsSections() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos, ordem fixa
        <div key={index} data-skeleton="settings-section" className="space-y-4">
          <div className="mb-4 flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary" />
            <Bar className="h-3 w-28" />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <Bar className="mb-3 h-3 w-2/5" />
            <Bar className="mb-4 h-2.5 w-3/5" />
            <div className="space-y-3">
              <Bar className="h-10 rounded-lg" />
              <Bar className="h-10 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function renderRecipe(
  layout: PageSkeletonLayout,
  count: number,
  columns: number,
  hero: HeroVariant,
  settings: boolean
): ReactNode {
  switch (layout) {
    case 'tweaks':
      return (
        <>
          <MaybeHero variant={hero} />
          <Toolbar />
          <Rows count={count} />
        </>
      );
    case 'list':
      return (
        <>
          <MaybeHero variant={hero} />
          <Refresh />
          <Toolbar />
          <Rows count={count} />
        </>
      );
    case 'dashboard':
      return (
        <>
          <MaybeHero variant={hero} />
          <Refresh />
          <Section>
            <CardGrid count={3} columns={3} />
          </Section>
          <Section>
            <CardGrid count={3} columns={3} />
          </Section>
          <Footer />
        </>
      );
    case 'meu-pc':
      return (
        <>
          <MaybeHero variant={hero} />
          <Refresh />
          <Section>
            <CardGrid count={3} columns={3} />
          </Section>
          <Section>
            <CardGrid count={3} columns={3} />
          </Section>
          <Section>
            <CardGrid count={9} columns={4} />
          </Section>
        </>
      );
    case 'history':
      return (
        <>
          <MaybeHero variant={hero} />
          <Stats count={4} />
          <Section>
            <TableLike headers={5} count={count} />
          </Section>
        </>
      );
    case 'restore':
      return (
        <>
          <MaybeHero variant={hero} />
          <Form />
          <Section>
            <TableLike headers={4} count={count} />
          </Section>
        </>
      );
    case 'startup':
      return (
        <>
          <MaybeHero variant={hero}>
            <StartupHero />
          </MaybeHero>
          <Refresh />
          <Tabs />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Bar className="h-9 w-72 rounded-md" />
            <Bar className="h-5 w-20 rounded-full" />
          </div>
          <TableLike headers={4} count={3} />
          <TableLike headers={4} count={3} />
          <TableLike headers={4} count={3} />
        </>
      );
    case 'device':
      return (
        <>
          <MaybeHero variant={hero} />
          {settings ? <SettingsPanel /> : null}
          <Section>
            <CardGrid count={count} columns={1} stacked />
          </Section>
        </>
      );
    case 'cards':
      return (
        <>
          <MaybeHero variant={hero} />
          <CardGrid count={count} columns={columns} stacked={columns === 1} />
        </>
      );
    case 'comparison':
      return (
        <>
          <MaybeHero variant={hero} />
          <Comparison />
        </>
      );
    case 'analysis':
      return (
        <>
          <MaybeHero variant={hero} />
          <Analysis count={count} />
        </>
      );
    case 'settings':
      return <SettingsPanel />;
    case 'overlay':
      return (
        <>
          <MaybeHero variant={hero} />
          <div className="space-y-4">
            {Array.from({ length: count }).map((_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos, ordem fixa
              <Bar key={index} data-skeleton="card" className="h-32 rounded-xl" />
            ))}
          </div>
        </>
      );
    case 'minimal':
      return (
        <>
          <MaybeHero variant={hero} />
          <Rows count={count} />
        </>
      );
    case 'dns':
      return (
        <>
          <MaybeHero variant={hero} />
          <DnsSkeleton count={count} />
        </>
      );
    case 'emulators':
      return (
        <>
          <MaybeHero variant={hero} />
          <AdbStatus />
          <CardGrid count={count} columns={columns} />
        </>
      );
    case 'settings-page':
      return (
        <>
          <MaybeHero variant={hero} />
          <SettingsSections />
        </>
      );
    default: {
      const exhaustive: never = layout;
      throw new Error(`Layout de esqueleto desconhecido: ${exhaustive}`);
    }
  }
}

/**
 * Esqueleto único de carregamento. Cada receita replica a geometria da página
 * final (hero, filtros, lista, cards ou tabela) para evitar salto de layout.
 * `data-skeleton` marca as partes estruturais para os testes de regressão.
 */
export function PageSkeleton({
  layout,
  count,
  columns = 3,
  hero,
  settings = true,
  label = 'Carregando…',
  className,
}: PageSkeletonProps) {
  const heroVariant =
    hero ?? (layout === 'device' ? 'photo' : NO_HERO.has(layout) ? 'none' : 'banner');

  return (
    <div role="status" aria-busy="true" aria-label={label} className={cn('space-y-6', className)}>
      {renderRecipe(layout, count ?? DEFAULT_COUNTS[layout], columns, heroVariant, settings)}
      <span className="sr-only">{label}</span>
    </div>
  );
}
