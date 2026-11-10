// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../../electron/shared/ipc-types';

/**
 * Regressão de exportar/importar dados.
 *
 * Os botões da seção são só a fiação para o contexto: exportar precisa chamar
 * `exportData` (que abre o download do backup) e o input escondido precisa
 * entregar o `File` escolhido para `importData`. Um `accept` errado ou um
 * arquivo não repassado deixaria o usuário sem restaurar o backup.
 */

const state = vi.hoisted(() => ({
  settings: {} as Partial<AppSettings>,
  update: vi.fn(),
  exportData: vi.fn(async () => {}),
  importData: vi.fn(async (_file: File) => {}),
}));

vi.mock('../../contexts/SettingsContext', () => ({
  useSettingsContext: () => ({
    settings: state.settings as AppSettings,
    update: state.update,
    loading: false,
    exportData: state.exportData,
    importData: state.importData,
  }),
}));

import { DataSection } from './DataSection';

beforeEach(() => {
  state.exportData.mockClear();
  state.importData.mockClear();
});

describe('DataSection', () => {
  it('renderiza as ações de exportar e importar', () => {
    render(<DataSection />);

    expect(screen.getByText('Dados')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Exportar Dados/ })).not.toBeNull();
    expect(screen.getByText('Importar Dados')).not.toBeNull();
  });

  it('chama exportData ao clicar em exportar', () => {
    render(<DataSection />);

    fireEvent.click(screen.getByRole('button', { name: /Exportar Dados/ }));

    expect(state.exportData).toHaveBeenCalledTimes(1);
    expect(state.importData).not.toHaveBeenCalled();
  });

  it('entrega o arquivo escolhido para importData', () => {
    const { container } = render(<DataSection />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.accept).toBe('.json');

    const file = new File(['{"settings":{}}'], 'backup.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(state.importData).toHaveBeenCalledTimes(1);
    expect(state.importData).toHaveBeenCalledWith(file);
  });

  it('não importa quando o seletor é cancelado', () => {
    const { container } = render(<DataSection />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });

    expect(state.importData).not.toHaveBeenCalled();
  });
});
