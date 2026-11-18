// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SpeedGauge } from './SpeedGauge';

const baseProps = {
  valueMbps: 42,
  maxMbps: 100,
  label: 'Download',
  progress: 0.5,
  phase: 'download' as const,
  active: true,
};

describe('SpeedGauge', () => {
  it('expõe o valor acessível com uma casa decimal', () => {
    render(<SpeedGauge {...baseProps} />);

    expect(screen.getByRole('img', { name: 'Download: 42.0 Mbps' })).toBeTruthy();
  });

  it('posiciona a agulha conforme a porcentagem do arco', () => {
    render(<SpeedGauge {...baseProps} />);

    // -135° + 42% de 270° = -21.6°
    expect(screen.getByTestId('gauge-needle').style.transform).toContain('rotate(-21.6deg)');
  });

  it('preenche o arco proporcionalmente ao valor', () => {
    render(<SpeedGauge {...baseProps} />);

    expect(Number(screen.getByTestId('gauge-fill').getAttribute('stroke-dashoffset'))).toBe(58);
  });

  it('usa escala de 1000 Mbps para não travar a agulha em conexões rápidas', () => {
    render(<SpeedGauge {...baseProps} valueMbps={800} maxMbps={undefined} />);

    // -135° + 80% de 270° = 81°
    expect(screen.getByTestId('gauge-needle').style.transform).toContain('rotate(81deg)');
  });

  it('mantém o movimento reduzido mesmo quando inativo', () => {
    const { rerender } = render(<SpeedGauge {...baseProps} />);

    expect(screen.getByTestId('gauge-needle').getAttribute('class')).toContain(
      'motion-reduce:transition-none'
    );

    rerender(<SpeedGauge {...baseProps} active={false} />);

    expect(screen.getByTestId('gauge-needle').getAttribute('class')).toContain(
      'motion-reduce:transition-none'
    );
  });
});
