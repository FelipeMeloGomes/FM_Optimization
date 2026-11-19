import { type PointerEvent, useState } from 'react';
import { cn } from '../../lib/utils';

interface TrailDot {
  x: number;
  y: number;
  opacity: number;
  size: number;
}

interface MouseTrailPreviewProps {
  pointerSpeed: number;
  enhancedPrecision: boolean;
  className?: string;
}

/**
 * Prévia visual do rastro. Não mexe no ponteiro do Windows: apenas desenha
 * pontos seguindo o mouse dentro desta área, com o comprimento influenciado
 * pela velocidade e pela aceleração escolhidas.
 */
export function MouseTrailPreview({
  pointerSpeed,
  enhancedPrecision,
  className,
}: MouseTrailPreviewProps) {
  const [trail, setTrail] = useState<TrailDot[]>([]);
  const length =
    Math.round(2 + ((Math.min(20, Math.max(1, pointerSpeed)) - 1) / 19) * 10) +
    (enhancedPrecision ? 2 : 0);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setTrail(
      Array.from({ length }, (_, index) => ({
        x: Math.max(4, x - index * 5),
        y: Math.max(4, y - index * 2.5),
        opacity: Math.max(0.1, 1 - index / length),
        size: Math.max(3, 11 - index * (6 / length)),
      }))
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="img"
        aria-label="Prévia do rastro do mouse"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setTrail([])}
        className="relative h-32 overflow-hidden rounded-lg border border-border bg-gradient-to-br from-secondary/60 to-background"
      >
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:20px_20px]" />
        {trail.map((dot, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: pontos do rastro são efêmeros e ordenados
            key={index}
            data-trail-dot
            className="pointer-events-none absolute rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]"
            style={{
              left: dot.x,
              top: dot.y,
              width: dot.size,
              height: dot.size,
              opacity: dot.opacity,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
        <span className="pointer-events-none absolute bottom-2 left-2 text-[10px] text-muted-foreground">
          Mova o mouse aqui
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Velocidade {pointerSpeed}/20</span>
        <span>{enhancedPrecision ? 'Aceleração ativa' : 'Movimento 1:1'}</span>
      </div>
    </div>
  );
}
