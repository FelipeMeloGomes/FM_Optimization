// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CleanerItemStats } from '../../electron/shared/ipc-types';
import { ConfirmCleanDialog } from './ConfirmCleanDialog';

/**
 * Confirmação da limpeza por itens: mostra o que será apagado, o total e só
 * dispara a ação no botão explícito.
 */

function item(overrides: Partial<CleanerItemStats> = {}): CleanerItemStats {
  return {
    id: 'temp-user',
    label: 'Temp do Usuário',
    description: '',
    group: 'sistema',
    requiresAdmin: false,
    fileCount: 10,
    totalSizeBytes: 1024,
    ...overrides,
  };
}

describe('ConfirmCleanDialog', () => {
  it('lista os itens selecionados e o total', () => {
    render(
      <ConfirmCleanDialog
        open
        onOpenChange={() => {}}
        items={[
          item({ totalSizeBytes: 2 * 1024 * 1024 * 1024 }),
          item({
            id: 'chrome',
            label: 'Cache do Google Chrome',
            totalSizeBytes: 512 * 1024 * 1024,
          }),
        ]}
        totalBytes={2.5 * 1024 * 1024 * 1024}
        onConfirm={() => {}}
      />
    );

    expect(screen.getByText('Confirmar limpeza')).not.toBeNull();
    expect(screen.getByText('2 itens selecionados')).not.toBeNull();
    expect(screen.getByText('Temp do Usuário')).not.toBeNull();
    expect(screen.getByText('Cache do Google Chrome')).not.toBeNull();
    expect(screen.getByText('2 GB')).not.toBeNull();
    expect(screen.getByText('512 MB')).not.toBeNull();
    expect(screen.getByText('2.5 GB')).not.toBeNull();

    const list = screen.getByRole('list');
    expect(list.className).toContain('max-h-48');
    expect(list.className).toContain('overscroll-contain');
  });

  it('usa singular para um único item', () => {
    render(
      <ConfirmCleanDialog
        open
        onOpenChange={() => {}}
        items={[item()]}
        totalBytes={1024}
        onConfirm={() => {}}
      />
    );

    expect(screen.getByText('1 item selecionado')).not.toBeNull();
  });

  it('só executa ao confirmar', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmCleanDialog
        open
        onOpenChange={onOpenChange}
        items={[item()]}
        totalBytes={1024}
        onConfirm={onConfirm}
      />
    );

    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
