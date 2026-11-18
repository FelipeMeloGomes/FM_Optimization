import type { CSSProperties } from 'react';
import type { SpeedTestPhase } from '../../electron/shared/ipc-types';

export interface SpeedGaugeProps {
  valueMbps: number;
  maxMbps?: number;
  progress: number;
  label: string;
  phase: SpeedTestPhase;
  active: boolean;
}

const CENTER = 100;
const RADIUS = 78;
const MIN_ANGLE = -135;
const SWEEP = 270;

function polar(angle: number): { x: number; y: number } {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.cos(rad),
    y: CENTER + RADIUS * Math.sin(rad),
  };
}

const START = polar(MIN_ANGLE);
const END = polar(MIN_ANGLE + SWEEP);
const ARC_PATH = `M ${START.x.toFixed(2)} ${START.y.toFixed(2)} A ${RADIUS} ${RADIUS} 0 1 1 ${END.x.toFixed(2)} ${END.y.toFixed(2)}`;

const PHASE_LABEL: Record<SpeedTestPhase, string> = {
  latency: 'Latência',
  download: 'Download',
  upload: 'Upload',
  done: 'Concluído',
};

export function SpeedGauge({
  valueMbps,
  maxMbps = 300,
  progress,
  label,
  phase,
  active,
}: SpeedGaugeProps) {
  const ratio = maxMbps > 0 ? Math.min(1, Math.max(0, valueMbps / maxMbps)) : 0;
  const angle = Math.round((MIN_ANGLE + ratio * SWEEP) * 10) / 10;
  const dashOffset = Math.round((1 - ratio) * 100);
  const needleStyle: CSSProperties = {
    transform: `rotate(${angle}deg)`,
    transformOrigin: `${CENTER}px ${CENTER}px`,
  };

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={`${label}: ${valueMbps.toFixed(1)} Mbps`}
      className={`w-full max-w-[280px] ${phase === 'done' ? 'text-success' : 'text-primary'}`}
    >
      <path
        d={ARC_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={10}
        strokeLinecap="round"
        className="text-muted-foreground opacity-30"
      />
      <path
        data-testid="gauge-fill"
        d={ARC_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={10}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="100 100"
        strokeDashoffset={dashOffset}
        className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
      />
      <g
        data-testid="gauge-needle"
        style={needleStyle}
        className={`transition-transform duration-700 ease-out motion-reduce:transition-none ${
          active ? 'opacity-100' : 'opacity-60'
        }`}
      >
        <line
          x1={CENTER}
          y1={CENTER}
          x2={CENTER}
          y2={CENTER - RADIUS + 14}
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={CENTER} cy={CENTER} r={6} fill="currentColor" />
      </g>
      <text
        x={CENTER}
        y={CENTER + 24}
        textAnchor="middle"
        className="fill-foreground text-[26px] font-semibold tabular-nums"
      >
        {valueMbps.toFixed(1)}
      </text>
      <text
        x={CENTER}
        y={CENTER + 42}
        textAnchor="middle"
        className="fill-muted-foreground text-[10px] font-medium uppercase tracking-[0.2em]"
      >
        Mbps
      </text>
      <text
        x={CENTER}
        y={CENTER + 72}
        textAnchor="middle"
        className="fill-foreground text-[11px] font-semibold uppercase tracking-widest"
      >
        {label}
      </text>
      <text
        x={CENTER}
        y={CENTER + 87}
        textAnchor="middle"
        className="fill-muted-foreground text-[9px] uppercase tracking-widest"
      >
        {PHASE_LABEL[phase]} · {Math.round(progress * 100)}%
      </text>
    </svg>
  );
}
