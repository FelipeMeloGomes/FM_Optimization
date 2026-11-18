import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { SpeedTestPhase } from '../../electron/shared/ipc-types';

export interface SpeedGaugeProps {
  valueMbps: number;
  maxMbps?: number;
  label: string;
  phase: SpeedTestPhase;
  active: boolean;
}

/**
 * Réplica da animação do medidor do Speedtest.net, extraída do bundle público
 * e confirmada ao vivo no site: escala não-linear, morfologia disco→anel→arco,
 * agulha com retorno entre fases e labels com stagger/flash. As cores vêm das
 * variáveis do tema (primary/accent/info/warning), mantendo a identidade do app.
 */
const VIEW = 286;
const CENTER = VIEW / 2;
const RADIUS = 130;
const STROKE = 23;
const START_ANGLE = -135;
const SWEEP = 270;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_LENGTH = (SWEEP / 360) * CIRCUMFERENCE;
const ARC_OFFSET = -(135 / 360) * CIRCUMFERENCE;
/** Duração do retargeting da agulha a cada nova amostra de velocidade. */
const TRACKING_MS = 250;
/** Janela em que a agulha volta ao início ao trocar de fase. */
const RETURN_MS = 250;

/** Escala não-linear do Speedtest.net — a agulha corre nos primeiros Mbps. */
const SCALE = [0, 5, 10, 50, 100, 250, 500, 750, 1000];

function polar(angle: number, radius = RADIUS): { x: number; y: number } {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function arcPath(from: number, to: number, radius = RADIUS): string {
  const a = polar(from, radius);
  const b = polar(to, radius);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

function sectorPath(from: number, to: number, radius = RADIUS + STROKE / 2): string {
  const a = polar(from, radius);
  const b = polar(to, radius);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
}

function labelAngle(index: number): number {
  return START_ANGLE + (index / (SCALE.length - 1)) * SWEEP;
}

function valueToAngle(mbps: number, maxMbps: number): number {
  if (maxMbps <= 0) return START_ANGLE;
  const scale = SCALE.map((value) => (value / 1000) * maxMbps);
  const value = Math.max(0, Math.min(mbps, maxMbps));
  const upper = scale.findIndex((item) => item >= value);
  if (upper <= 0) return labelAngle(Math.max(0, upper));
  if (upper === -1) return labelAngle(SCALE.length - 1);
  const lower = upper - 1;
  const span = scale[upper] - scale[lower];
  const fraction = span > 0 ? (value - scale[lower]) / span : 0;
  return labelAngle(lower) + fraction * (labelAngle(upper) - labelAngle(lower));
}

export function SpeedGauge({ valueMbps, maxMbps = 1000, label, phase, active }: SpeedGaugeProps) {
  const targetAngle = valueToAngle(valueMbps, maxMbps);
  const lastPhase = useRef(phase);
  const lastTarget = useRef(targetAngle);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [needleAngle, setNeedleAngle] = useState(targetAngle);
  const [needleKey, setNeedleKey] = useState(0);
  const [morphKey, setMorphKey] = useState(0);
  const [holding, setHolding] = useState(false);

  // O medidor nunca apaga. Bugs de animação observados na UI real corrigidos aqui:
  //  1) o disco→anel→arco toca só na ENTRADA do teste (fase latency). Ele não
  //     pode reaparecer quando a conexão termina e o download começa;
  //  2) um teste novo remonta a agulha, evitando que ela varredure de volta
  //     desde o resultado anterior durante a fase de latência;
  //  3) na troca download→upload a agulha volta a -135° e IGNORA as amostras
  //     que chegam antes da volta terminar — sem isso ela parava no meio do
  //     arco (~22°) porque a primeira amostra de upload redirecionava o CSS;
  //  4) o retargeting caiu de 450 ms para 250 ms para a agulha não ficar
  //     defasada do número exibido quando as amostras chegam rápido.
  useEffect(() => {
    const phaseChanged = lastPhase.current !== phase;
    const targetChanged = lastTarget.current !== targetAngle;
    lastPhase.current = phase;
    lastTarget.current = targetAngle;

    if (phaseChanged) {
      // Novo teste: única hora de repetir a morph e o stagger dos rótulos.
      if (phase === 'latency') setMorphKey((key) => key + 1);
      if (holdTimer.current) clearTimeout(holdTimer.current);

      // Novo teste e resultado final não são fases de medição: a agulha vai
      // direto ao destino, sem o retorno animado (que só existe na troca
      // download→upload).
      if (phase === 'latency' || phase === 'done') {
        setNeedleKey((key) => key + 1);
        setNeedleAngle(phase === 'latency' ? START_ANGLE : targetAngle);
        setHolding(false);
        return;
      }

      if (phase === 'upload') {
        setNeedleAngle(START_ANGLE);
        setHolding(true);
        holdTimer.current = setTimeout(() => {
          setHolding(false);
          setNeedleAngle(lastTarget.current);
        }, RETURN_MS);
        return;
      }
    }

    // latency→download: a agulha já está em -135°, não há retorno para
    // proteger — a primeira amostra move a agulha de imediato.
    if (!holding && targetChanged) setNeedleAngle(targetAngle);
  }, [phase, targetAngle, holding]);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    []
  );

  const fillFraction = Math.max(0, Math.min(1, (needleAngle - START_ANGLE) / SWEEP));
  const fillDash = fillFraction * ARC_LENGTH;
  const isUpload = phase === 'upload';
  const gradientId = isUpload ? 'speed-gauge-upload' : 'speed-gauge-download';

  const needleStyle: CSSProperties = {
    transform: `rotate(${needleAngle}deg)`,
    transformOrigin: `${CENTER}px ${CENTER}px`,
    transitionDuration: `${holding ? RETURN_MS : TRACKING_MS}ms`,
    transitionTimingFunction: 'ease-out',
  };

  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <style>{`
        @keyframes speed-gauge-morph-entry {
          0%   { r: 45px; stroke-width: 90px; stroke-dasharray: ${CIRCUMFERENCE.toFixed(1)} 0; stroke-dashoffset: 0; opacity: 1; }
          55%  { r: ${RADIUS}px; stroke-width: ${STROKE}px; stroke-dasharray: ${CIRCUMFERENCE.toFixed(1)} 0; stroke-dashoffset: 0; opacity: 1; }
          75%  { r: ${RADIUS}px; stroke-width: ${STROKE}px; stroke-dasharray: ${ARC_LENGTH.toFixed(1)} ${(CIRCUMFERENCE - ARC_LENGTH).toFixed(1)}; stroke-dashoffset: ${ARC_OFFSET.toFixed(1)}; opacity: 1; }
          100% { r: ${RADIUS}px; stroke-width: ${STROKE}px; stroke-dasharray: ${ARC_LENGTH.toFixed(1)} ${(CIRCUMFERENCE - ARC_LENGTH).toFixed(1)}; stroke-dashoffset: ${ARC_OFFSET.toFixed(1)}; opacity: 0; }
        }
        @keyframes speed-gauge-morph-exit {
          0%   { r: ${RADIUS}px; stroke-width: ${STROKE}px; stroke-dasharray: ${ARC_LENGTH.toFixed(1)} ${(CIRCUMFERENCE - ARC_LENGTH).toFixed(1)}; stroke-dashoffset: ${ARC_OFFSET.toFixed(1)}; opacity: 1; }
          45%  { r: ${RADIUS}px; stroke-width: ${STROKE}px; stroke-dasharray: ${CIRCUMFERENCE.toFixed(1)} 0; stroke-dashoffset: 0; opacity: 1; }
          100% { r: 45px; stroke-width: 90px; stroke-dasharray: ${CIRCUMFERENCE.toFixed(1)} 0; stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes speed-gauge-label-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes speed-gauge-label-flash {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        .speed-gauge-morph-in { animation: speed-gauge-morph-entry 450ms ease-in-out both; }
        .speed-gauge-morph-out { animation: speed-gauge-morph-exit 620ms ease-in-out both; }
        .speed-gauge-label { animation: speed-gauge-label-in 80ms ease-out both; }
        .speed-gauge-label-flash { animation: speed-gauge-label-flash 80ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .speed-gauge-morph-in, .speed-gauge-morph-out,
          .speed-gauge-label, .speed-gauge-label-flash { animation: none; }
        }
      `}</style>

      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        role="img"
        aria-label={`${label}: ${valueMbps.toFixed(1)} Mbps`}
        className="w-full text-foreground"
      >
        <defs>
          <linearGradient id="speed-gauge-download" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-accent)" />
            <stop offset="50%" stopColor="var(--color-primary)" />
            <stop offset="100%" stopColor="var(--color-info)" />
          </linearGradient>
          <linearGradient id="speed-gauge-upload" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="55%" stopColor="var(--color-warning)" />
            <stop offset="100%" stopColor="var(--color-accent)" />
          </linearGradient>
          <linearGradient id="speed-gauge-needle" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--color-foreground)" />
            <stop offset="60%" stopColor="var(--color-foreground)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--color-foreground)" stopOpacity="0.35" />
          </linearGradient>
          <clipPath id="speed-gauge-fill-clip">
            <path d={sectorPath(START_ANGLE, Math.max(START_ANGLE + 0.01, needleAngle))} />
          </clipPath>
        </defs>

        {/* Trilho inativo */}
        <path
          d={arcPath(START_ANGLE, START_ANGLE + SWEEP)}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={STROKE}
          strokeLinecap="butt"
        />

        <g key={`content-${needleKey}`} data-testid="gauge-content">
          {/* Arco gradiente preenchido até a agulha */}
          <path
            data-testid="gauge-fill"
            d={arcPath(START_ANGLE, START_ANGLE + SWEEP)}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={STROKE}
            strokeLinecap="butt"
            pathLength={ARC_LENGTH}
            strokeDasharray={`${fillDash.toFixed(2)} ${ARC_LENGTH.toFixed(2)}`}
            clipPath="url(#speed-gauge-fill-clip)"
            className="transition-[stroke-dasharray] ease-out motion-reduce:transition-none"
            style={{ transitionDuration: `${TRACKING_MS}ms` }}
          />

          {/* Agulha trapezoidal (base 20, ponta 10, comprimento 85) */}
          <g
            data-testid="gauge-needle"
            style={needleStyle}
            className="transition-transform motion-reduce:transition-none"
          >
            <path
              d={`M ${CENTER - 10} ${CENTER} L ${CENTER + 10} ${CENTER} L ${CENTER + 5} ${CENTER - 85} L ${CENTER - 5} ${CENTER - 85} Z`}
              fill="url(#speed-gauge-needle)"
            />
          </g>
        </g>

        {/* Anel de morfologia da largada/chegada — remontado a cada troca de fase */}
        <circle
          key={morphKey}
          data-testid="gauge-morph"
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={STROKE}
          className={
            phase === 'done' ? 'speed-gauge-morph-out' : active ? 'speed-gauge-morph-in' : ''
          }
          style={{ opacity: active || phase === 'done' ? undefined : 0 }}
        />

        {/* Rótulos da escala não-linear */}
        <g key={`labels-${morphKey}`} data-testid="gauge-labels">
          {SCALE.map((value, index) => {
            const angle = labelAngle(index);
            const point = polar(angle, RADIUS - 33);
            const passed = needleAngle >= angle;
            const textProps = {
              x: point.x,
              y: point.y,
              textAnchor: 'middle' as const,
              dominantBaseline: 'middle' as const,
              fontSize: '13',
              fontWeight: 'bold',
            };
            return (
              <g
                key={value}
                className="speed-gauge-label"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <text
                  {...textProps}
                  fill={passed ? 'currentColor' : 'var(--color-muted-foreground)'}
                >
                  {value}
                </text>
                {passed && (
                  <text
                    key={`flash-${passed}`}
                    {...textProps}
                    fill="var(--color-foreground)"
                    className="speed-gauge-label-flash"
                    style={{ pointerEvents: 'none' }}
                  >
                    {value}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        <g data-testid="gauge-readout">
          <text
            x={CENTER}
            y={CENTER + 58}
            textAnchor="middle"
            className="fill-foreground font-mono text-[38px] font-medium tabular-nums"
          >
            {valueMbps.toFixed(1)}
          </text>
          <text
            x={CENTER}
            y={CENTER + 86}
            textAnchor="middle"
            className="fill-muted-foreground text-xs font-medium uppercase tracking-[0.24em]"
          >
            MBPS - {label}
          </text>
        </g>
      </svg>
    </div>
  );
}
