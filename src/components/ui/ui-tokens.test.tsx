// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Badge } from './badge';
import { Button } from './button';
import { Dialog, DialogContent } from './dialog';
import { Switch } from './switch';
import { Tabs } from './tabs';

describe('componentes base com tokens de tema', () => {
  it('usa tokens do card no botão subtle em vez do background da página', () => {
    render(<Button variant="subtle">Recomendados</Button>);

    const button = screen.getByRole('button', { name: 'Recomendados' });
    expect(button.className).toContain('bg-card/50');
    expect(button.className).toContain('hover:bg-muted');
    expect(button.className).toContain('hover:text-foreground');
  });

  it('mantém o thumb do switch desligado visível', () => {
    render(<Switch aria-label="Ativar" />);

    const thumb = document.querySelector('[data-state="unchecked"] > span');
    expect(thumb?.className).toContain('data-[state=unchecked]:bg-muted-foreground');
  });

  it('aceita rótulo acessível nas abas', () => {
    render(
      <Tabs
        ariaLabel="Apps do Windows"
        items={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]}
        value="a"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('tablist').getAttribute('aria-label')).toBe('Apps do Windows');
  });

  it('move o foco para a aba seguinte ao usar a seta direita', () => {
    const onChange = vi.fn();
    render(
      <Tabs
        ariaLabel="Apps"
        items={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]}
        value="a"
        onChange={onChange}
      />
    );

    const first = screen.getByRole('tab', { name: 'A' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('usar o foreground do accent ao abrir o diálogo', () => {
    render(
      <Dialog open>
        <DialogContent>
          <p>Conteúdo</p>
        </DialogContent>
      </Dialog>
    );

    const close = screen.getByRole('button', { name: 'Fechar' });
    expect(close.className).toContain('data-[state=open]:text-accent-foreground');
    expect(close.className).not.toContain('data-[state=open]:text-muted-foreground');
  });

  it('não aplica ring de foco em badge não interativo', () => {
    render(<Badge>Ativo</Badge>);

    expect(screen.getByText('Ativo').className).not.toContain('focus:outline-none');
  });
});
