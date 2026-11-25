// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GpuCatalog,
  GpuCatalogEntry,
  GpuCatalogResult,
} from '../../electron/shared/ipc-types';

const mocks = vi.hoisted(() => ({
  systemName: undefined as string | undefined,
}));

vi.mock('../contexts/SystemContext', () => ({
  useSystemContext: () => ({
    state: mocks.systemName
      ? { status: 'success', data: { gpu: { name: mocks.systemName } } }
      : { status: 'loading' },
  }),
}));

import CompararPlacaPage from './CompararPlacaPage';

const catalog: GpuCatalog = {
  version: 1,
  source: 'Technical City / PassMark',
  sourceUrl: 'https://technical.city/pt/gpu',
  updatedAt: '2026-11-19T00:00:00.000Z',
  gpus: [
    {
      id: 'rtx-4090',
      name: 'GeForce RTX 4090',
      manufacturer: 'NVIDIA',
      architecture: 'Ada Lovelace',
      vramGb: 24,
      vramType: 'GDDR6X',
      performanceScore: 38014,
    },
    {
      id: 'rx-7800-xt',
      name: 'Radeon RX 7800 XT',
      manufacturer: 'AMD',
      architecture: 'RDNA 3',
      vramGb: 16,
      performanceScore: 24481,
    },
    {
      id: 'arc-a770',
      name: 'Arc A770',
      manufacturer: 'Intel',
      vramGb: 16,
      performanceScore: 13380,
    },
  ],
};

function installApi(result: GpuCatalogResult = { ...catalog, isFromCache: false }) {
  const getGpuCatalog = vi.fn(async () => result);
  const searchGpu = vi.fn(async (_name: string): Promise<GpuCatalogEntry | null> => null);
  (window as unknown as { electronAPI: unknown }).electronAPI = { getGpuCatalog, searchGpu };
  return { getGpuCatalog, searchGpu };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.systemName = undefined;
});

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('CompararPlacaPage', () => {
  it('mostra a ilustração das placas junto com a GPU detectada no banner', async () => {
    mocks.systemName = 'NVIDIA GeForce RTX 4090';
    installApi();

    render(<CompararPlacaPage />);

    expect(
      await screen.findByRole('img', {
        name: 'Ilustração de duas placas de vídeo lado a lado',
      })
    ).toBeTruthy();
    expect((await screen.findByText(/Detectada:/)).textContent).toContain(
      'NVIDIA GeForce RTX 4090'
    );
  });

  it('mostra o esqueleto da comparação enquanto o catálogo carrega', () => {
    const { getGpuCatalog } = installApi();
    getGpuCatalog.mockImplementationOnce(() => new Promise<GpuCatalogResult>(() => {}));

    const { container } = render(<CompararPlacaPage />);

    expect(screen.getByText('Carregando catálogo de placas de vídeo…')).toBeTruthy();
    expect(container.querySelectorAll('[data-skeleton="picker"]')).toHaveLength(2);
    expect(container.querySelector('[data-skeleton="versus"]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton="column"]')).not.toBeNull();
  });

  it('abre com a placa detectada na Placa A e mostra o selo', async () => {
    mocks.systemName = 'NVIDIA GeForce RTX 4090';
    const { getGpuCatalog, searchGpu } = installApi();

    render(<CompararPlacaPage />);

    expect(await screen.findByRole('heading', { name: 'Comparar Placas' })).toBeTruthy();
    await waitFor(() => expect(getGpuCatalog).toHaveBeenCalledTimes(1));
    expect(searchGpu).not.toHaveBeenCalled();

    const placaA = (await screen.findByRole('combobox', { name: 'Placa A' })) as HTMLInputElement;
    const placaB = (await screen.findByRole('combobox', { name: 'Placa B' })) as HTMLInputElement;
    expect(placaA.value).toBe('GeForce RTX 4090');
    expect(placaB.value).toBe('Radeon RX 7800 XT');

    expect(screen.getAllByText('Detectada').length).toBeGreaterThan(0);
    expect(screen.getByText('Sua placa')).toBeTruthy();
    expect(screen.getAllByText('38.014').length).toBeGreaterThan(0);
    expect(screen.getAllByText('24.481').length).toBeGreaterThan(0);
  });

  it('busca online quando a placa detectada não está no catálogo', async () => {
    mocks.systemName = 'GeForce RTX 4070';
    const { searchGpu } = installApi();
    searchGpu.mockResolvedValueOnce({
      id: 'rtx-4070',
      name: 'GeForce RTX 4070',
      manufacturer: 'NVIDIA',
      performanceScore: 28000,
    });

    render(<CompararPlacaPage />);

    await waitFor(() => expect(searchGpu).toHaveBeenCalledWith('GeForce RTX 4070'));
    const placaA = (await screen.findByRole('combobox', { name: 'Placa A' })) as HTMLInputElement;
    expect(placaA.value).toBe('GeForce RTX 4070');
    expect(await screen.findByText(/foi encontrada online/)).toBeTruthy();
  });

  it('filtra as placas enquanto o usuário digita e aplica a escolha', async () => {
    installApi();

    render(<CompararPlacaPage />);

    const placaB = (await screen.findByRole('combobox', { name: 'Placa B' })) as HTMLInputElement;
    fireEvent.focus(placaB);
    fireEvent.change(placaB, { target: { value: '7800' } });

    const listbox = await screen.findByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('Radeon RX 7800 XT');

    fireEvent.click(within(listbox).getByRole('option', { name: /Radeon RX 7800 XT/ }));
    expect(placaB.value).toBe('Radeon RX 7800 XT');
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.focus(placaB);
    fireEvent.change(placaB, { target: { value: 'arc' } });
    const arcOption = (await screen.findByRole('listbox')).querySelector('[role="option"]');
    expect(arcOption?.textContent).toContain('Arc A770');
    fireEvent.click(arcOption as HTMLElement);
    expect(placaB.value).toBe('Arc A770');

    const linhaScore = screen.getByText('Pontuação PassMark').closest('tr');
    expect(within(linhaScore as HTMLElement).getByText('13.380')).toBeTruthy();
  });

  it('mostra erro e permite tentar novamente quando o catálogo falha', async () => {
    const getGpuCatalog = vi
      .fn()
      .mockRejectedValueOnce(new Error('catálogo indisponível'))
      .mockResolvedValueOnce({ ...catalog, isFromCache: false });
    const searchGpu = vi.fn(async () => null);
    (window as unknown as { electronAPI: unknown }).electronAPI = { getGpuCatalog, searchGpu };

    render(<CompararPlacaPage />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('catálogo indisponível');

    fireEvent.click(within(alert).getByRole('button', { name: /tentar novamente/i }));

    await waitFor(() => expect(getGpuCatalog).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('combobox', { name: 'Placa A' })).toBeTruthy();
  });

  it('exibe o aviso de dados vindos do cache', async () => {
    installApi({ ...catalog, isFromCache: true });

    render(<CompararPlacaPage />);

    expect(await screen.findByText(/dados em cache/i)).toBeTruthy();
  });

  it('não aponta vencedor quando A e B são a mesma placa', async () => {
    installApi();
    render(<CompararPlacaPage />);

    const placaB = (await screen.findByRole('combobox', { name: 'Placa B' })) as HTMLInputElement;
    fireEvent.focus(placaB);
    fireEvent.click(
      within(await screen.findByRole('listbox')).getByRole('option', { name: /GeForce RTX 4090/ })
    );

    expect(screen.queryAllByText('Mais rápida')).toHaveLength(0);
    expect(screen.queryByText(/de diferença a favor/i)).toBeNull();
  });

  it('não aponta vencedor quando as placas têm a mesma pontuação', async () => {
    const tied: GpuCatalog = {
      ...catalog,
      gpus: [
        { id: 'a', name: 'Placa A', manufacturer: 'NVIDIA', performanceScore: 100 },
        { id: 'b', name: 'Placa B', manufacturer: 'AMD', performanceScore: 100 },
      ],
    };
    installApi({ ...tied, isFromCache: false });
    render(<CompararPlacaPage />);

    expect(await screen.findByRole('combobox', { name: 'Placa A' })).toBeTruthy();
    expect(screen.queryAllByText('Mais rápida')).toHaveLength(0);
    expect(screen.queryByText(/de diferença a favor/i)).toBeNull();
  });

  it('seta para baixo com a lista fechada escolhe a primeira opção', async () => {
    installApi();
    render(<CompararPlacaPage />);

    const placaA = (await screen.findByRole('combobox', { name: 'Placa A' })) as HTMLInputElement;
    fireEvent.focus(placaA);
    fireEvent.keyDown(placaA, { key: 'Escape' });
    fireEvent.keyDown(placaA, { key: 'ArrowDown' });
    fireEvent.keyDown(placaA, { key: 'Enter' });

    expect(placaA.value).toBe('GeForce RTX 4090');
  });

  it('marca a placa detectada mesmo depois que o usuário escolheu outra', async () => {
    installApi();
    const view = render(<CompararPlacaPage />);

    const placaB = (await screen.findByRole('combobox', { name: 'Placa B' })) as HTMLInputElement;
    fireEvent.focus(placaB);
    fireEvent.change(placaB, { target: { value: 'arc' } });
    fireEvent.click(
      within(await screen.findByRole('listbox')).getByRole('option', { name: /Arc A770/ })
    );
    expect(placaB.value).toBe('Arc A770');

    mocks.systemName = 'NVIDIA GeForce RTX 4090';
    view.rerender(<CompararPlacaPage />);

    await waitFor(() => expect(screen.getByText('Sua placa')).toBeTruthy());
    expect(placaB.value).toBe('Arc A770');
  });

  it('recarregar o catálogo mantém a placa detectada marcada', async () => {
    const { getGpuCatalog } = installApi();
    const view = render(<CompararPlacaPage />);

    expect(await screen.findByRole('combobox', { name: 'Placa A' })).toBeTruthy();
    expect(screen.queryByText('Sua placa')).toBeNull();

    mocks.systemName = 'NVIDIA GeForce RTX 4090';
    view.rerender(<CompararPlacaPage />);
    expect(await screen.findByText('Sua placa')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Recarregar catálogo/i }));

    await waitFor(() => expect(getGpuCatalog).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Sua placa')).toBeTruthy();
  });

  it('aponta a opção ativa no combobox para leitores de tela', async () => {
    installApi();
    render(<CompararPlacaPage />);

    const placaA = (await screen.findByRole('combobox', { name: 'Placa A' })) as HTMLInputElement;
    fireEvent.focus(placaA);
    const listbox = await screen.findByRole('listbox');
    const primeira = within(listbox).getByRole('option', { name: /RTX 4090/ });
    const segunda = within(listbox).getByRole('option', { name: /RX 7800 XT/ });

    expect(primeira.id).not.toBe('');
    expect(placaA.getAttribute('aria-activedescendant')).toBe(primeira.id);

    fireEvent.keyDown(placaA, { key: 'ArrowDown' });
    expect(placaA.getAttribute('aria-activedescendant')).toBe(segunda.id);

    fireEvent.keyDown(placaA, { key: 'Escape' });
    expect(placaA.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('não cria um container de scroll próprio na tabela de especificações', async () => {
    installApi();
    render(<CompararPlacaPage />);

    expect(await screen.findByText('Especificações lado a lado')).toBeTruthy();
    const table = document.querySelector('table') as HTMLTableElement;
    expect(table).not.toBeNull();
    const wrapper = table.parentElement as HTMLElement;
    expect(wrapper.className).not.toContain('overflow-auto');
    expect(wrapper.className).toContain('overflow-visible');
  });
});
