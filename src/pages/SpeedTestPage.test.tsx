// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A página é a fronteira visível do teste de velocidade: estado idle, fase de
 * medição, resultado travado e erro com nova tentativa. O contexto é mockado
 * aqui; o cálculo real e o estado real têm testes próprios.
 */

vi.mock('../contexts/SpeedContext', () => ({
  useSpeedContext: () => store.speed,
  SpeedProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import SpeedTestPage from './SpeedTestPage';

const store = vi.hoisted(() => ({
  speed: {
    status: 'idle' as 'idle' | 'measuring' | 'done' | 'error',
    progress: {
      phase: 'latency' as 'latency' | 'download' | 'upload' | 'done',
      progress: 0,
      currentMbps: null as number | null,
    },
    result: null as {
      downloadMbps: number;
      uploadMbps: number;
      pingMs: number;
      jitterMs: number;
    } | null,
    error: null as string | null,
    start: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
  },
}));

function speed(overrides: Partial<typeof store.speed> = {}) {
  store.speed = {
    status: 'idle',
    progress: { phase: 'latency', progress: 0, currentMbps: null },
    result: null,
    error: null,
    start: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    ...overrides,
  };
}

beforeEach(() => speed());
afterEach(() => vi.restoreAllMocks());

describe('SpeedTestPage', () => {
  it('mostra o titulo, o botao Iniciar e o medidor zerado no estado idle', () => {
    render(<SpeedTestPage />);

    expect(screen.getByText('Teste de Velocidade')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'Download: 0.0 Mbps' })).toBeDefined();
  });

  it('mostra fase e progresso durante a medição', () => {
    speed({
      status: 'measuring',
      progress: { phase: 'download', progress: 0.5, currentMbps: 42 },
    });
    render(<SpeedTestPage />);

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDefined();
    expect(screen.getByText('Medindo download…')).toBeDefined();
    expect(screen.getByRole('progressbar', { name: 'Progresso do teste' })).toBeDefined();
  });

  it('trava o resultado na tela ao terminar', () => {
    speed({
      status: 'done',
      progress: { phase: 'done', progress: 1, currentMbps: null },
      result: { downloadMbps: 95.5, uploadMbps: 42.3, pingMs: 12, jitterMs: 2 },
    });
    render(<SpeedTestPage />);

    expect(screen.getByText('Download', { selector: 'p' })).toBeDefined();
    expect(screen.getByText('Upload', { selector: 'p' })).toBeDefined();
    expect(screen.getByText('Ping', { selector: 'p' })).toBeDefined();
    expect(screen.getByText('Jitter', { selector: 'p' })).toBeDefined();
    expect(screen.getByText('95.5', { selector: 'p' })).toBeDefined();
    expect(screen.getByText('42.3', { selector: 'p' })).toBeDefined();
    expect(screen.getByText('12', { selector: 'p' })).toBeDefined();
    expect(screen.getByText('2', { selector: 'p' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Testar novamente' })).toBeDefined();
  });

  it('mostra erro e permite tentar novamente', () => {
    speed({ status: 'error', error: 'Sem conexão com a internet' });
    const { start } = store.speed;
    render(<SpeedTestPage />);

    expect(screen.getByRole('alert').textContent).toContain('Sem conexão com a internet');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('inicia o teste ao clicar em Iniciar', () => {
    const { start } = store.speed;
    render(<SpeedTestPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }));

    expect(start).toHaveBeenCalledTimes(1);
  });
});
