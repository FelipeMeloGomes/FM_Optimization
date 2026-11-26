// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AsyncState,
  DashboardData,
  ExecutionHistoryEntry,
  ScriptEntry,
} from '../../electron/shared/ipc-types';

const store = vi.hoisted(() => ({
  system: { status: 'loading' } as AsyncState<DashboardData>,
  scripts: { status: 'loading' } as AsyncState<ScriptEntry[]>,
  history: { status: 'loading' } as AsyncState<ExecutionHistoryEntry[]>,
  execute: vi.fn(async (_id: string) => {}),
}));

vi.mock('../contexts/SystemContext', () => ({
  useSystemContext: () => ({
    state: store.system,
    refreshing: false,
    refresh: () => {},
    hasFetched: true,
    isFromCache: false,
  }),
}));

vi.mock('../contexts/ScriptContext', () => ({
  useScriptContext: () => ({ state: store.scripts }),
}));

vi.mock('../contexts/HistoryContext', () => ({
  useHistoryContext: () => ({ state: store.history }),
}));

vi.mock('../contexts/ScriptExecutionContext', () => ({
  useScriptExecutionContext: () => ({
    activeExecution: null,
    execute: store.execute,
    cancel: vi.fn(),
  }),
}));

import MeuPcPage from './MeuPcPage';

const dashboard: DashboardData = {
  cpu: {
    model: 'AMD Ryzen 7 9800X3D',
    manufacturer: 'AMD',
    vendor: 'amd',
    cores: 8,
    logicalProcessors: 16,
    architecture: 'x64',
    usage: 12,
    rawModel: 'AMD Ryzen 7 9800X3D 8-Core Processor',
    family: '107',
    modelNumber: '38',
    stepping: '1',
    maxClockMhz: 4700,
    nameSource: 'wmi',
    nameIsGeneric: false,
    coresEstimated: false,
  },
  gpu: {
    name: 'NVIDIA GeForce RTX 5090',
    rawName: 'NVIDIA GeForce RTX 5090 (OEM)',
    vram: '32 GB',
    driverVersion: '32.0.15',
    usage: 4,
  },
  memory: {
    total: '32 GB',
    used: '12 GB',
    free: '20 GB',
    type: 'DDR5',
    frequency: '6000 MHz',
    slots: 2,
    slotsUsed: 2,
    slotsTotal: 4,
  },
  motherboard: {
    manufacturer: 'Gigabyte Technology Co., Ltd.',
    product: 'X870 AORUS ELITE WIFI7',
    version: '1.0',
    biosVersion: '5.17',
    biosReleaseDate: '02/01/2023',
  },
  caches: { l1: '640 KB', l2: '8 MB', l3: '32 MB' },
  os: {
    name: 'Windows 11 Pro',
    version: '10.0.26100',
    build: '26100',
    edition: 'Pro',
    installDate: '/Date(1735689600000)/',
  },
  drives: [
    {
      letter: 'C:',
      label: 'Sistema',
      size: '1 TB',
      free: '400 GB',
      usedPercent: 60,
      type: 'SSD NVMe',
      fileSystem: 'NTFS',
    },
    {
      letter: 'D:',
      label: 'Dados',
      size: '2 TB',
      free: '1 TB',
      usedPercent: 50,
      type: 'SSD',
      fileSystem: 'exFAT',
    },
  ],
  uptime: 90061,
};

beforeEach(() => {
  vi.clearAllMocks();
  store.system = { status: 'success', data: dashboard };
  store.scripts = { status: 'success', data: [] };
  store.history = { status: 'success', data: [] };
});

function iconDoWidget(container: HTMLElement, label: string): Element {
  const rotulo = Array.from(container.querySelectorAll('span')).find(
    (element) => element.textContent === label && element.className.includes('uppercase')
  );
  const icone = rotulo?.closest('div.rounded-lg')?.querySelector('div.size-9 > svg');
  if (!icone) throw new Error(`Ícone do widget ${label} não encontrado`);
  return icone;
}

describe('MeuPcPage', () => {
  it('mostra os três grupos de cards no esqueleto, com nove itens no último', () => {
    store.system = { status: 'loading' };

    const { container } = render(<MeuPcPage />);
    const grids = container.querySelectorAll('[data-skeleton="grid"]');

    expect(grids).toHaveLength(3);
    expect(grids[2].children.length).toBe(9);
  });

  it('mostra o título e a descrição lida do Windows', () => {
    render(<MeuPcPage />);

    expect(screen.getByText('Meu PC')).toBeTruthy();
    expect(screen.getByText(/lido direto do Windows/i)).toBeTruthy();
  });

  it('lista os nove itens do sistema sem Check-up', () => {
    render(<MeuPcPage />);

    const itens = within(screen.getByTestId('itens-do-sistema'));
    for (const label of [
      'Processador',
      'Caches',
      'Placa-mãe',
      'Memória',
      'Slots de memória',
      'Placa de vídeo',
      'Armazenamento',
      'Sistema operacional',
      'Tempo de atividade',
    ]) {
      expect(itens.getByRole('tab', { name: label })).toBeTruthy();
    }
    expect(itens.queryByText('Check-up')).toBeNull();
  });

  it('exporta o relatório usando o script Relatorios do Sistema', () => {
    render(<MeuPcPage />);

    fireEvent.click(screen.getByRole('button', { name: /exportar relatório/i }));

    expect(store.execute).toHaveBeenCalledWith('util-3');
  });

  it('expõe os nomes como abas, com setas de rolagem horizontal', () => {
    render(<MeuPcPage />);
    const itens = within(screen.getByTestId('itens-do-sistema'));

    expect(itens.getByRole('tablist')).toBeTruthy();
    expect(itens.getAllByRole('tab')).toHaveLength(9);
    expect(itens.getByRole('button', { name: /rolar para a esquerda/i })).toBeTruthy();
    expect(itens.getByRole('button', { name: /rolar para a direita/i })).toBeTruthy();
  });

  it('mostra os detalhes completos do processador como item ativo inicial', () => {
    render(<MeuPcPage />);
    const itens = within(screen.getByTestId('itens-do-sistema'));
    const painel = within(itens.getByRole('tabpanel'));

    expect(itens.getByRole('tab', { name: /processador/i }).getAttribute('aria-selected')).toBe(
      'true'
    );

    for (const [label, value] of [
      ['Nome original', 'AMD Ryzen 7 9800X3D 8-Core Processor'],
      ['Fabricante', 'AMD'],
      ['Vendor', 'amd'],
      ['Núcleos físicos', '8'],
      ['Processadores lógicos', '16'],
      ['Arquitetura', 'x64'],
      ['Uso atual', '12%'],
      ['Família', '107'],
      ['Número do modelo', '38'],
      ['Stepping', '1'],
      ['Clock máximo', '4700 MHz'],
      ['Origem do nome', 'wmi'],
      ['Nome genérico', 'Não'],
    ] as const) {
      expect(painel.getByText(label)).toBeTruthy();
      expect(painel.getByText(value)).toBeTruthy();
    }
  });

  it('troca o painel ao clicar em outro nome e deixa só um item ativo', () => {
    render(<MeuPcPage />);
    const itens = within(screen.getByTestId('itens-do-sistema'));
    const processador = itens.getByRole('tab', { name: /processador/i });
    const memoria = itens.getByRole('tab', { name: /^memória/i });

    fireEvent.click(memoria);

    expect(processador.getAttribute('aria-selected')).toBe('false');
    expect(memoria.getAttribute('aria-selected')).toBe('true');
    expect(itens.queryByText('Arquitetura')).toBeNull();
    expect(itens.getByText('Frequência')).toBeTruthy();
    expect(itens.getByText('6000 MHz')).toBeTruthy();
  });

  it('mantém o painel ao clicar no item já ativo', () => {
    render(<MeuPcPage />);
    const itens = within(screen.getByTestId('itens-do-sistema'));
    const processador = itens.getByRole('tab', { name: /processador/i });

    fireEvent.click(processador);

    expect(processador.getAttribute('aria-selected')).toBe('true');
    expect(itens.getByText('Arquitetura')).toBeTruthy();
  });

  it('mostra os detalhes de cada unidade de armazenamento na mesma lista', () => {
    render(<MeuPcPage />);
    const itens = within(screen.getByTestId('itens-do-sistema'));

    fireEvent.click(itens.getByRole('tab', { name: /armazenamento/i }));

    expect(itens.getByText('C: Sistema')).toBeTruthy();
    expect(itens.getByText('D: Dados')).toBeTruthy();
    expect(itens.getAllByText('Sistema de arquivos')).toHaveLength(2);
    expect(itens.getByText('NTFS')).toBeTruthy();
    expect(itens.getByText('exFAT')).toBeTruthy();
    expect(itens.getByText('2 TB')).toBeTruthy();
  });

  it('troca os detalhes de caches, placa-mãe, slots de memória e placa de vídeo', () => {
    render(<MeuPcPage />);
    const itens = within(screen.getByTestId('itens-do-sistema'));

    for (const [name, expected] of [
      [/caches/i, '640 KB'],
      [/placa-mãe/i, '1.0'],
      [/slots de memória/i, 'Módulos detectados'],
      [/placa de vídeo/i, 'NVIDIA GeForce RTX 5090 (OEM)'],
    ] as const) {
      const aba = itens.getByRole('tab', { name });
      fireEvent.click(aba);
      expect(aba.getAttribute('aria-selected')).toBe('true');
      expect(itens.getByText(expected)).toBeTruthy();
    }

    expect(itens.getByText('Versão do driver')).toBeTruthy();
  });

  it('troca os detalhes do sistema operacional e do tempo de atividade', () => {
    render(<MeuPcPage />);
    const itens = within(screen.getByTestId('itens-do-sistema'));

    fireEvent.click(itens.getByRole('tab', { name: /sistema operacional/i }));

    expect(itens.getAllByText('Windows 11 Pro').length).toBeGreaterThan(0);
    expect(itens.getAllByText('10.0.26100').length).toBeGreaterThan(0);
    expect(itens.getAllByText('26100').length).toBeGreaterThan(0);
    expect(itens.getAllByText('Pro').length).toBeGreaterThan(0);
    expect(itens.getByText('01/01/2025')).toBeTruthy();
    expect(itens.getByText('Data de instalação')).toBeTruthy();

    fireEvent.click(itens.getByRole('tab', { name: /tempo de atividade/i }));

    expect(itens.getByText('1 d 1 h 1 min 1 s')).toBeTruthy();
    expect(itens.getByText('90061')).toBeTruthy();
    expect(itens.getByText('Total em segundos')).toBeTruthy();
    expect(itens.getByText('Dias')).toBeTruthy();
    expect(itens.getByText('Horas')).toBeTruthy();
    expect(itens.getByText('Minutos')).toBeTruthy();
    expect(itens.getByText('Segundos')).toBeTruthy();
  });

  it('explica a versão ausente da placa-mãe e mostra os dados reais da BIOS', () => {
    store.system = {
      status: 'success',
      data: {
        ...dashboard,
        motherboard: {
          manufacturer: 'Gigabyte Technology Co., Ltd.',
          product: 'X870 AORUS ELITE WIFI7',
          version: '',
          biosVersion: '5.17',
          biosReleaseDate: '02/01/2023',
        },
      },
    };
    render(<MeuPcPage />);
    const itens = within(screen.getByTestId('itens-do-sistema'));

    fireEvent.click(itens.getByRole('tab', { name: /placa-mãe/i }));

    expect(itens.getByText('Versão')).toBeTruthy();
    expect(itens.getByText('Não informada')).toBeTruthy();
    expect(itens.getByText('Versão da BIOS')).toBeTruthy();
    expect(itens.getByText('5.17')).toBeTruthy();
    expect(itens.getByText('Data da BIOS')).toBeTruthy();
    expect(itens.getByText('02/01/2023')).toBeTruthy();
    expect(itens.queryByText('—')).toBeNull();
  });

  it('mostra Sem rótulo para unidades sem nome de volume', () => {
    store.system = {
      status: 'success',
      data: {
        ...dashboard,
        drives: dashboard.drives.map((drive) => ({ ...drive, label: '' })),
      },
    };
    render(<MeuPcPage />);
    const itens = within(screen.getByTestId('itens-do-sistema'));

    fireEvent.click(itens.getByRole('tab', { name: /armazenamento/i }));

    expect(itens.getAllByText('Sem rótulo')).toHaveLength(2);
    expect(itens.queryByText('—')).toBeNull();
  });

  it('usa as cores do tema nos ícones de todos os widgets', () => {
    const { container } = render(<MeuPcPage />);

    for (const label of [
      'Processador',
      'Placa de vídeo',
      'Placa-mãe',
      'Memória',
      'Armazenamento',
      'Caches',
    ]) {
      const icone = iconDoWidget(container, label);
      expect(icone.parentElement?.className).toContain('bg-primary/10');
      expect(icone.getAttribute('class')).toContain('text-primary');
    }
  });

  it('mostra o hero com um PC desktop e descrição animada no estilo do Monitor', () => {
    render(<MeuPcPage />);

    expect(
      screen.getByRole('img', { name: /gabinete de PC desktop com iluminação RGB/i })
    ).toBeTruthy();
    expect(document.querySelector('p.blur-text')?.textContent).toContain('lido direto do Windows');
  });

  it('anima os rótulos das abas e o painel dos Itens do sistema', () => {
    const { container } = render(<MeuPcPage />);
    const itens = within(screen.getByTestId('itens-do-sistema'));
    const rotulos = [
      'Processador',
      'Caches',
      'Placa-mãe',
      'Memória',
      'Slots de memória',
      'Placa de vídeo',
      'Armazenamento',
      'Sistema operacional',
      'Tempo de atividade',
    ];

    itens.getAllByRole('tab').forEach((aba, indice) => {
      expect(aba.querySelector('[data-tab-label]')?.textContent).toContain(rotulos[indice]);
    });
    expect(container.querySelector('[data-panel-animation]')).toBeTruthy();

    fireEvent.click(itens.getByRole('tab', { name: /^memória/i }));

    expect(container.querySelector('[data-panel-animation]')?.textContent).toContain('6000 MHz');
  });
});
