// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  OptimizationProgress,
  OptimizationReport,
  OptimizationSummary,
  OptimizationTweakStatus,
} from '../../electron/shared/ipc-types';

/**
 * A página traduz o relatório do main em nota, pendências e aplicação em lote.
 * Os testes verificam texto visível, chamadas IPC e o fluxo de confirmação —
 * não uma reimplementação da página.
 */

const state = vi.hoisted(() => ({
  report: null as OptimizationReport | null,
  analysisError: null as string | null,
  admin: true,
  packaged: true,
  setSimulation: vi.fn(async () => {}),
  summary: {
    applied: ['tweaks-2'],
    failed: [],
    skipped: ['tweaks-1'],
    cancelled: false,
    requiresRestart: ['Ajuste pendente'],
  } as OptimizationSummary,
  applyError: null as string | null,
  analyze: vi.fn<() => Promise<OptimizationReport>>(),
  apply: vi.fn<() => Promise<OptimizationSummary>>(),
  cancel: vi.fn(async () => {}),
  elevate: vi.fn(async () => ({ launched: true, cancelled: false })),
  progressCb: null as ((progress: OptimizationProgress) => void) | null,
  toasts: [] as { type: string; title: string; description?: string }[],
}));

vi.mock('../components/EnhancedToast', () => ({
  showEnhancedToast: (options: { type: string; title: string; description?: string }) => {
    state.toasts.push(options);
  },
}));

vi.mock('../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({ settings: { soundEnabled: false } }),
}));

import OptimizePcPage from './OptimizePcPage';

function tweak(
  id: string,
  name: string,
  status: OptimizationTweakStatus['status']
): OptimizationTweakStatus {
  return {
    id,
    area: 'interface',
    name,
    description: `Descrição de ${name}`,
    riskLevel: 'moderate',
    requiresAdmin: true,
    requiresRestart: status === 'pending',
    status,
    checks: [],
  };
}

function deferredApply() {
  let resolve!: (summary: OptimizationSummary) => void;
  const promise = new Promise<OptimizationSummary>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function sampleReport(): OptimizationReport {
  return {
    score: 5,
    applied: 1,
    pending: 1,
    unknown: 1,
    total: 3,
    areas: [
      { area: 'interface', label: 'Interface', applied: 1, total: 2, score: 5 },
      { area: 'rede', label: 'Rede', applied: 0, total: 1, score: null },
    ],
    tweaks: [
      tweak('tweaks-1', 'Ajuste aplicado', 'applied'),
      tweak('tweaks-2', 'Ajuste pendente', 'pending'),
      tweak('builtin-32', 'Ajuste não verificado', 'unknown'),
    ],
    generatedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.report = sampleReport();
  state.analysisError = null;
  state.admin = true;
  state.packaged = true;
  state.applyError = null;
  state.progressCb = null;
  state.toasts = [];
  state.summary = {
    applied: ['tweaks-2'],
    failed: [],
    skipped: ['tweaks-1'],
    cancelled: false,
    requiresRestart: ['Ajuste pendente'],
  };

  state.analyze.mockImplementation(async () => {
    if (state.analysisError) throw new Error(state.analysisError);
    return state.report as OptimizationReport;
  });
  state.apply.mockImplementation(async () => {
    if (state.applyError) throw new Error(state.applyError);
    state.progressCb?.({
      current: 1,
      total: 1,
      id: 'tweaks-2',
      name: 'Ajuste pendente',
      status: 'done',
    });
    return state.summary;
  });

  (window as unknown as { electronAPI: unknown }).electronAPI = {
    isAdmin: vi.fn(async () => state.admin),
    isPackaged: vi.fn(async () => state.packaged),
    setOptimizationSimulation: state.setSimulation,
    analyzeOptimization: state.analyze,
    applyOptimization: state.apply,
    cancelOptimization: state.cancel,
    elevateApp: state.elevate,
    onOptimizationProgress: (cb: (progress: OptimizationProgress) => void) => {
      state.progressCb = cb;
      return () => {
        state.progressCb = null;
      };
    },
  };
});

describe('OptimizePcPage', () => {
  it('mostra o modo simulação só em dev e não grava nada ao ligá-lo', async () => {
    state.packaged = false;
    render(<OptimizePcPage />);

    expect(screen.queryByRole('switch', { name: 'Modo simulação' })).toBeNull();
    const toggle = await screen.findByRole('switch', { name: 'Modo simulação' });
    fireEvent.click(toggle);

    await waitFor(() => expect(state.setSimulation).toHaveBeenCalledWith(true));
    expect(await screen.findByText(/Simulação ativa/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Analisar PC' })).toBeTruthy();
  });

  it('só analisa quando o usuário clica', async () => {
    render(<OptimizePcPage />);

    expect(state.analyze).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Analisar PC' })).toBeTruthy();
    expect(screen.getByText(/Nenhuma análise feita ainda/)).toBeTruthy();
  });

  it('mostra nota, contadores, áreas e pendências depois da análise', async () => {
    render(<OptimizePcPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Analisar PC' }));

    await waitFor(() => expect(state.analyze).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Nota 5 de 10')).toBeTruthy();
    expect(screen.getByText(/1 de 3 ajustes aplicados/)).toBeTruthy();
    expect(screen.getByText(/1 não verificado/)).toBeTruthy();
    expect(screen.getByText('Interface', { selector: '.sr-only' })).toBeTruthy();
    expect(screen.getByText('Rede', { selector: '.sr-only' })).toBeTruthy();
    expect(screen.getByText('Ajuste pendente')).toBeTruthy();
    expect(screen.getByText('Ajuste não verificado')).toBeTruthy();
    expect(screen.getByText('1 ajuste(s) pendente(s)')).toBeTruthy();
    expect(screen.getByText(/A nota mede aderência ao plano/)).toBeTruthy();
  });

  it('separa cobertura e índice de cada área com progresso e texto explícito', async () => {
    render(<OptimizePcPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Analisar PC' }));
    await screen.findByText('Nota 5 de 10');

    expect(screen.getByText('Cobertura')).toBeTruthy();
    expect(screen.getByText(/é a nota de 0 a 10 da área/)).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: 'Interface: 1 de 2 ajustes aplicados' })
    ).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: 'Rede: 0 de 1 ajustes aplicados' })
    ).toBeTruthy();
    expect(screen.getByText('Índice de Interface: 5 de 10')).toBeTruthy();
    expect(screen.getByText('Sem índice')).toBeTruthy();
  });

  it('mostra erro de análise com nova tentativa', async () => {
    state.analysisError = 'acesso negado';
    render(<OptimizePcPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Analisar PC' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Não foi possível analisar o PC: acesso negado');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(state.analyze).toHaveBeenCalledTimes(2));
  });

  it('avisa sobre admin e não deixa aplicar sem elevar', async () => {
    state.admin = false;
    render(<OptimizePcPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Analisar PC' }));
    await screen.findByText('Nota 5 de 10');

    const elevate = screen.getByRole('button', { name: 'Reiniciar como admin' });
    expect(elevate).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Aplicar otimizações' }) as HTMLButtonElement).disabled
    ).toBe(true);

    fireEvent.click(elevate);
    await waitFor(() =>
      expect(state.elevate).toHaveBeenCalledWith(undefined, undefined, undefined, true)
    );
  });

  it('confirma, mostra progresso, sumário e reanalisa ao aplicar', async () => {
    const deferred = deferredApply();
    state.apply.mockImplementation(() => {
      state.progressCb?.({
        current: 1,
        total: 1,
        id: 'tweaks-2',
        name: 'Ajuste pendente',
        status: 'running',
      });
      return deferred.promise;
    });

    render(<OptimizePcPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Analisar PC' }));
    await screen.findByText('Nota 5 de 10');

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar otimizações' }));
    expect(screen.getByRole('dialog').textContent).toContain('Aplicar otimizações?');
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar agora' }));

    expect(await screen.findByText(/Aplicando 1 de 1: Ajuste pendente/)).toBeTruthy();
    deferred.resolve(state.summary);

    expect(await screen.findByText(/1 aplicado\(s\)/)).toBeTruthy();
    expect(screen.getByText(/Reinicie o PC para concluir/)).toBeTruthy();
    await waitFor(() => expect(state.analyze).toHaveBeenCalledTimes(2));
    expect(state.progressCb).toBeNull();
  });

  it('permite cancelar a aplicação em andamento', async () => {
    const deferred = deferredApply();
    state.apply.mockImplementation(() => deferred.promise);

    render(<OptimizePcPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Analisar PC' }));
    await screen.findByText('Nota 5 de 10');

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar otimizações' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar agora' }));
    await waitFor(() => expect(state.apply).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(state.cancel).toHaveBeenCalledTimes(1));
  });
});
