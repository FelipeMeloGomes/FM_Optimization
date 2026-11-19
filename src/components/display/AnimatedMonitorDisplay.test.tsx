// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnimatedMonitorDisplay } from './AnimatedMonitorDisplay';

describe('AnimatedMonitorDisplay', () => {
  it('mostra o monitor decorativo animado e escondido de leitores de tela', () => {
    const { container } = render(<AnimatedMonitorDisplay />);

    const visual = container.querySelector('.animate-monitor-pulse');
    expect(visual).not.toBeNull();
    expect(visual?.getAttribute('aria-hidden')).toBe('true');
  });
});
