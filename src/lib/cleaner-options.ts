interface CleanerOption {
  id: string;
  name: string;
  description: string;
  requiresAdmin: boolean;
}

/**
 * Espelha o catálogo em `resources/scripts.json`: a mesma ordem e o mesmo
 * `requiresAdmin`, que é o que decide se a limpeza vira pendência.
 */
export const CLEANER_OPTIONS: CleanerOption[] = [
  {
    id: 'cleaner-1',
    name: 'Limpeza Rápida',
    description: 'Temporários, logs, prefetch, lixeira e miniaturas',
    requiresAdmin: true,
  },
  {
    id: 'cleaner-2',
    name: 'Limpeza de Atualizações',
    description: 'Cache do Windows Update, Store e shaders DirectX',
    requiresAdmin: true,
  },
  {
    id: 'cleaner-3',
    name: 'Limpeza de Navegadores',
    description: 'Cache do Chrome, Edge, Firefox e Brave',
    requiresAdmin: false,
  },
  {
    id: 'cleaner-4',
    name: 'Limpeza Total',
    description: 'Faxina completa do Windows',
    requiresAdmin: true,
  },
];

export function cleanerName(id: string): string {
  return CLEANER_OPTIONS.find((option) => option.id === id)?.name ?? id;
}

const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

export function formatNextRun(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const sameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, now)) return `hoje às ${time}`;

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (sameDay(date, tomorrow)) return `amanhã às ${time}`;

  const diffDays = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000
  );

  if (diffDays > 0 && diffDays < 7) return `${WEEKDAYS[date.getDay()]}, ${time}`;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month} às ${time}`;
}
