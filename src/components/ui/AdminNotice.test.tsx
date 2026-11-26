// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { Lock } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AdminNotice } from './AdminNotice';

describe('AdminNotice', () => {
  it('mostra a mensagem simples com tokens de aviso e ícone padrão', () => {
    const html = renderToStaticMarkup(
      <AdminNotice message="Itens com cadeado exigem administrador." />
    );

    expect(html).toContain('Itens com cadeado exigem administrador.');
    expect(html).toContain('border-warning/20');
    expect(html).toContain('bg-warning/5');
    expect(html).toContain('text-warning');
    expect(html).toContain('lucide-shield-alert');
    expect(html).toContain('aria-hidden="true"');
  });

  it('mantém título e descrição informados pelo chamador', () => {
    render(
      <AdminNotice
        message={
          <div>
            <p>Sem permissão de administrador</p>
            <p>Reinicie o app elevado para controlá-los.</p>
          </div>
        }
      />
    );

    expect(screen.getByText('Sem permissão de administrador')).toBeTruthy();
    expect(screen.getByText('Reinicie o app elevado para controlá-los.')).toBeTruthy();
  });

  it('usa padding compacto e ícone customizado quando informados', () => {
    const html = renderToStaticMarkup(
      <AdminNotice compact message="Aviso" icon={<Lock data-testid="custom-icon" />} />
    );

    expect(html).toContain('px-4 py-3');
    expect(html).not.toContain('class="p-4"');
    expect(html).toContain('data-testid="custom-icon"');
  });

  it('não cria botão sem callback de relançamento', () => {
    const html = renderToStaticMarkup(<AdminNotice message="Aviso" />);

    expect(html).not.toContain('<button');
    expect(html).not.toContain('Reiniciar como admin');
  });

  it('oferece relançamento secondary por padrão e outline quando pedido', () => {
    const html = renderToStaticMarkup(
      <AdminNotice message="Aviso" onRelaunch={() => {}} relaunchVariant="outline" />
    );
    const defaultHtml = renderToStaticMarkup(<AdminNotice message="Aviso" onRelaunch={() => {}} />);

    expect(defaultHtml).toContain('bg-secondary');
    expect(html).toContain('border-input');
    expect(html).toContain('Reiniciar como admin');
    expect(html).toContain('lucide-shield-check');
  });

  it('desabilita o relançamento enquanto ele está em andamento', () => {
    const html = renderToStaticMarkup(
      <AdminNotice message="Aviso" onRelaunch={() => {}} relaunching />
    );

    expect(html).toContain('disabled=""');
  });

  it('chama o callback de relançamento ao clicar', () => {
    const onRelaunch = vi.fn();
    render(<AdminNotice message="Aviso" onRelaunch={onRelaunch} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar como admin' }));

    expect(onRelaunch).toHaveBeenCalledTimes(1);
  });
});
