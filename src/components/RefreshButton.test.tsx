// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageRefreshBar, RefreshButton } from './RefreshButton';

describe('RefreshButton', () => {
  it('usa o visual outline opaco e dispara a atualização ao clicar', () => {
    const onRefresh = vi.fn();

    render(<RefreshButton onRefresh={onRefresh} />);
    const button = screen.getByRole('button', { name: 'Atualizar' });

    expect(button.className).toContain('bg-card');
    expect(button.className).toContain('border-input');
    expect(button.className).toContain('h-9');
    fireEvent.click(button);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('gira o ícone, mostra o texto de carga e bloqueia novos cliques', () => {
    const onRefresh = vi.fn();

    const { container } = render(<RefreshButton onRefresh={onRefresh} refreshing />);
    const button = screen.getByRole('button', { name: 'Atualizando…' });

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(container.querySelector('svg')?.classList.contains('animate-spin')).toBe(true);
    fireEvent.click(button);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('aceita rótulos próprios sem perder o ícone girando', () => {
    const { container } = render(
      <RefreshButton
        onRefresh={() => {}}
        label="Testar Novamente"
        refreshingLabel="Testando…"
        refreshing
      />
    );

    expect(screen.getByRole('button', { name: 'Testando…' })).toBeDefined();
    expect(container.querySelector('svg')?.classList.contains('animate-spin')).toBe(true);
  });

  it('mantém o nome acessível no modo só ícone', () => {
    render(<RefreshButton onRefresh={() => {}} iconOnly ariaLabel="Atualizar lista de apps" />);

    expect(screen.getByRole('button', { name: 'Atualizar lista de apps' })).toBeDefined();
    expect(screen.queryByText('Atualizar')).toBeNull();
  });
});

describe('PageRefreshBar', () => {
  it('mostra o status à esquerda e o botão alinhado à direita, fora do hero', () => {
    render(<PageRefreshBar onRefresh={() => {}} status={<span>Atualizado há 2 minutos</span>} />);

    const bar = screen.getByRole('group', { name: 'Atualizar dados' });

    expect(bar.className).toContain('justify-end');
    expect(bar.textContent).toContain('Atualizado há 2 minutos');
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeDefined();
  });

  it('mantém ações extras na mesma faixa do botão de atualizar', () => {
    render(
      <PageRefreshBar onRefresh={() => {}}>
        <button type="button">Exportar relatório…</button>
      </PageRefreshBar>
    );

    const bar = screen.getByRole('group', { name: 'Atualizar dados' });

    expect(bar.textContent).toContain('Exportar relatório…');
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeDefined();
  });

  it('abre espaço extra quando um aviso vem logo abaixo da faixa', () => {
    render(<PageRefreshBar onRefresh={() => {}} followedByNotice />);

    expect(screen.getByRole('group', { name: 'Atualizar dados' }).className).toContain('pb-6');
  });

  it('não abre espaço extra quando não há aviso abaixo', () => {
    render(<PageRefreshBar onRefresh={() => {}} />);

    expect(screen.getByRole('group', { name: 'Atualizar dados' }).className).not.toContain('pb-6');
  });
});
