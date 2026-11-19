import { cn } from '../../lib/utils';

interface KeyboardPreviewProps {
  repeatDelay: number;
  repeatRate: number;
  caretBlinkRate: number;
  className?: string;
}

/**
 * Prévia visual: o cursor pisca no tempo escolhido e a tecla "A" demonstra o
 * atraso e a velocidade de repetição. Não altera nenhuma configuração real.
 */
export function KeyboardPreview({
  repeatDelay,
  repeatRate,
  caretBlinkRate,
  className,
}: KeyboardPreviewProps) {
  const delayMs = (Math.min(3, Math.max(0, repeatDelay)) + 1) * 250;
  const repeatsPerSecond = 2 + (Math.min(31, Math.max(0, repeatRate)) / 31) * 28;
  const repeatSeconds = 1 / repeatsPerSecond;

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="img"
        aria-label="Prévia do teclado"
        className="relative flex h-24 items-center overflow-hidden rounded-lg border border-border bg-gradient-to-br from-secondary/60 to-background px-4"
      >
        <div className="flex h-10 items-center rounded-md border border-border bg-background/80 px-3 font-mono text-sm text-foreground">
          <span
            data-repeat
            className="animate-key-repeat"
            style={{
              animationDelay: `${delayMs / 1000}s`,
              animationDuration: `${repeatSeconds}s`,
            }}
          >
            AAAAA
          </span>
          <span
            data-caret
            className="animate-key-caret ml-0.5 inline-block h-4 w-0.5 bg-primary"
            style={{ animationDuration: `${caretBlinkRate / 1000}s` }}
          />
        </div>
        <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
          prévia.local
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Piscagem {caretBlinkRate} ms</span>
        <span>Repetir após {delayMs} ms</span>
      </div>
    </div>
  );
}
