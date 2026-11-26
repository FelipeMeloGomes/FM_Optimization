// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsPanelShell } from './SettingsPanelShell';

describe('SettingsPanelShell', () => {
  it('usa o título padrão, o header e os tokens do tema', () => {
    const { container } = render(
      <SettingsPanelShell badge="tempo real">
        <span>controle</span>
      </SettingsPanelShell>
    );

    const section = container.querySelector('section');
    expect(section?.className).toBe(
      'flex flex-col gap-5 rounded-xl border border-border bg-card p-5'
    );
    expect(section?.className).not.toMatch(/#[0-9a-f]{3,8}|rgb\(|white|black|gray-/i);

    const title = screen.getByRole('heading', { name: 'Ajustes do Windows' });
    expect(title.className).toBe('text-sm font-semibold text-foreground');
    expect(title.parentElement?.className).toBe('flex items-center justify-between gap-3');
    expect(screen.getByText('controle')).not.toBeNull();
  });

  it.each(['tempo real', 'Por monitor', 'Por disco'])('mantém o badge "%s"', (badge) => {
    render(
      <SettingsPanelShell badge={badge}>
        <span>controle</span>
      </SettingsPanelShell>
    );

    const element = screen.getByText(badge);
    expect(element.tagName).toBe('SPAN');
    expect(element.className).toBe(
      'shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground'
    );
    expect(element.className).not.toMatch(/#[0-9a-f]{3,8}|rgb\(|white|black|gray-/i);
  });

  it('renderiza a nota informativa abaixo do conteúdo', () => {
    render(
      <SettingsPanelShell badge="Por monitor" note="A mudança pode desligar a tela">
        <span>controle</span>
      </SettingsPanelShell>
    );

    const note = screen.getByText('A mudança pode desligar a tela');
    expect(note.tagName).toBe('P');
    expect(note.className).toBe('text-[10px] text-muted-foreground');
  });

  it('aceita className para alternar o espaçamento do painel', () => {
    const { container } = render(
      <SettingsPanelShell badge="Por disco" className="gap-4">
        <span>controle</span>
      </SettingsPanelShell>
    );

    const className = container.querySelector('section')?.className ?? '';
    expect(className).toContain('gap-4');
    expect(className).not.toContain('gap-5');
    expect(className).toContain('rounded-xl border border-border bg-card p-5');
  });
});
