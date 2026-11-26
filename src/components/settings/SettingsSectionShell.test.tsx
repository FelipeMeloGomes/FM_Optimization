// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsSectionShell } from './SettingsSectionShell';

describe('SettingsSectionShell', () => {
  it('mantém o título com a hierarquia e os tokens do tema', () => {
    const { container } = render(
      <SettingsSectionShell title="Tema" tone="primary">
        <span>conteúdo</span>
      </SettingsSectionShell>
    );

    const title = screen.getByRole('heading', { name: 'Tema' });
    expect(title.className).toBe('text-sm font-semibold text-foreground');

    const header = title.parentElement;
    expect(header?.className).toBe('mb-4 flex items-center gap-2');
    expect(container.querySelector('[class~="size-1.5"]')).not.toBeNull();
  });

  it.each([
    ['primary', 'bg-primary'],
    ['warning', 'bg-warning'],
    ['info', 'bg-info'],
    ['success', 'bg-success'],
  ] as const)('aplica o token %s ao dot da seção', (tone, expected) => {
    const { container } = render(
      <SettingsSectionShell title="Seção" tone={tone}>
        <span>conteúdo</span>
      </SettingsSectionShell>
    );

    const dot = container.querySelector('[class~="size-1.5"]');
    expect(dot?.className).toBe(`size-1.5 rounded-full ${expected}`);
    expect(dot?.className).not.toMatch(/#[0-9a-f]{3,8}|rgb\(|white|black|gray-/i);
  });

  it('usa linhas separadas por padrão', () => {
    const { container } = render(
      <SettingsSectionShell title="Preferencias" tone="primary">
        <span>primeira</span>
        <span>segunda</span>
      </SettingsSectionShell>
    );

    const card = container.querySelector('[class~="rounded-xl"]');
    expect(card?.className).toBe('divide-y divide-border rounded-xl border border-border bg-card');

    const rows = container.querySelectorAll('[class~="p-4"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].className).toBe('p-4 transition-colors duration-200 hover:bg-muted/30');
    expect(rows[0].textContent).toBe('primeira');
    expect(rows[1].textContent).toBe('segunda');
  });

  it('usa um painel único quando variant é panel', () => {
    const { container } = render(
      <SettingsSectionShell title="Dados" tone="info" variant="panel">
        <span>conteúdo do painel</span>
      </SettingsSectionShell>
    );

    const card = container.querySelector('[class~="rounded-xl"]');
    expect(card?.className).toBe('rounded-xl border border-border bg-card p-5');
    expect(card?.textContent).toBe('conteúdo do painel');
    expect(container.querySelector('[class~="p-4"]')).toBeNull();
  });
});
