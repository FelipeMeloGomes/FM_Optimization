import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScriptEntry } from '../../electron/shared/ipc-types';

/**
 * Regressão dos selos que acompanham cada tweak.
 *
 * O selo "Aplicado" só pode aparecer quando o histórico confirma uma execução
 * bem-sucedida — é a mesma regra do contador do Dashboard. Admin, Reiniciar e o
 * nível de risco vêm direto do catálogo e não podem vazar para scripts que não
 * os declaram. O SSR basta: os selos são puramente derivados das props.
 */

const store = vi.hoisted(() => ({
  applied: new Set<string>(),
}));

vi.mock('../hooks/use-is-script-applied', () => ({
  useIsScriptApplied: () => (script: { id: string }) => store.applied.has(script.id),
}));

// ScriptBadge importa RISK_STYLES de ScriptCard, que puxa o SettingsContext e,
// por ele, o tema — e o BatmanBackground instancia `Path2D` no topo do módulo,
// API de canvas inexistente no node. O fundo não influencia os selos.
vi.mock('./BatmanBackground', () => ({ BatmanBackground: () => null }));

import { ScriptBadge } from './ScriptBadge';

function script(overrides: Partial<ScriptEntry> = {}): ScriptEntry {
  return {
    id: 'cpu-1',
    name: 'Tweak de CPU',
    description: 'Descrição',
    category: 'CPU',
    subcategory: '',
    content: '',
    extension: 'ps1',
    requiresAdmin: false,
    isBuiltIn: true,
    tags: [],
    ...overrides,
  };
}

/** Texto visível, sem tags e sem os comentários que o SSR insere entre nós. */
function text(html: string): string {
  return html
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function render(entry: ScriptEntry): string {
  return renderToStaticMarkup(<ScriptBadge script={entry} />);
}

beforeEach(() => {
  store.applied = new Set<string>();
});

describe('ScriptBadge — selo Aplicado', () => {
  it('mostra o selo quando o histórico tem execução bem-sucedida', () => {
    store.applied.add('cpu-1');

    const html = render(script());

    expect(text(html)).toContain('Aplicado');
    expect(html).toContain('border-emerald-500/50');
    expect(html).toContain('text-emerald-400');
  });

  it('não mostra o selo quando o script ainda não foi executado', () => {
    store.applied.add('outro-script');

    const html = render(script());

    expect(text(html)).not.toContain('Aplicado');
  });

  it('não confunde o id do script com o de outra entrada', () => {
    // Regressão: o selo já foi pintado para todos os cards quando a comparação
    // olhava apenas se o histórico estava carregado.
    store.applied.add('cpu-2');

    expect(text(render(script({ id: 'cpu-1' })))).not.toContain('Aplicado');
    expect(text(render(script({ id: 'cpu-2' })))).toContain('Aplicado');
  });
});

describe('ScriptBadge — selos do catálogo', () => {
  it('mostra Admin apenas quando o script exige elevação', () => {
    const withAdmin = render(script({ requiresAdmin: true }));
    const withoutAdmin = render(script());

    expect(text(withAdmin)).toContain('Admin');
    expect(withAdmin).toContain('bg-destructive');
    expect(text(withoutAdmin)).not.toContain('Admin');
  });

  it('mostra Reiniciar apenas quando o script exige reinício', () => {
    const withRestart = render(script({ requiresRestart: true }));
    const withoutRestart = render(script());

    expect(text(withRestart)).toContain('Reiniciar');
    expect(withRestart).toContain('border-amber-500/50');
    expect(text(withoutRestart)).not.toContain('Reiniciar');
  });

  it('traduz o nível de risco e aplica a cor correspondente', () => {
    const safe = render(script({ riskLevel: 'safe' }));
    const moderate = render(script({ riskLevel: 'moderate' }));
    const deep = render(script({ riskLevel: 'deep' }));

    expect(text(safe)).toContain('Seguro');
    expect(safe).toContain('bg-green-500/20');

    expect(text(moderate)).toContain('Moderado');
    expect(moderate).toContain('bg-yellow-500/20');

    expect(text(deep)).toContain('Completo');
    expect(deep).toContain('bg-red-500/20');
  });

  it('não mostra selo de risco quando o script não declara risco', () => {
    const html = text(render(script()));

    expect(html).not.toContain('Seguro');
    expect(html).not.toContain('Moderado');
    expect(html).not.toContain('Completo');
  });

  it('mantém a ordem Aplicado, Admin, Reiniciar e risco', () => {
    store.applied.add('cpu-1');

    const html = render(
      script({ requiresAdmin: true, requiresRestart: true, riskLevel: 'moderate' })
    );
    const order = ['Aplicado', 'Admin', 'Reiniciar', 'Moderado'].map((label) =>
      html.indexOf(label)
    );

    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
