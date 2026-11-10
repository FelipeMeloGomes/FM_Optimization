import { Cpu } from 'lucide-react';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

/**
 * Regressão dos cartões do Dashboard.
 *
 * O widget é o mesmo para CPU, RAM, disco e saúde: o que muda é o status (cor do
 * ícone e do hover) e a barra de progresso. Valor vazio precisa cair no "—" em
 * vez de deixar o cartão em branco, e a barra só existe quando há percentual.
 */

import { DashboardWidget } from './DashboardWidget';

/** Texto visível, sem tags e sem os comentários que o SSR insere entre nós. */
function text(html: string): string {
  return html
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function render(props: Partial<ComponentProps<typeof DashboardWidget>> = {}): string {
  return renderToStaticMarkup(<DashboardWidget icon={Cpu} label="CPU" value="12%" {...props} />);
}

/** As classes arbitrárias do Tailwind saem escapadas no HTML do SSR. */
function cls(name: string): string {
  return name.replace(/&/g, '&amp;').replace(/>/g, '&gt;');
}

describe('DashboardWidget — conteúdo', () => {
  it('mostra rótulo, valor e detalhe', () => {
    const html = text(render({ detail: '8 núcleos · 16 threads' }));

    expect(html).toContain('CPU');
    expect(html).toContain('12%');
    expect(html).toContain('8 núcleos · 16 threads');
  });

  it('usa "—" quando o valor vem vazio', () => {
    // Regressão: leituras que falham chegam como string vazia e o cartão ficava
    // sem nenhum valor visível.
    expect(text(render({ value: '' }))).toContain('—');
  });

  it('omite o detalhe quando não é informado', () => {
    expect(text(render())).not.toContain('núcleos');
  });
});

describe('DashboardWidget — barra de progresso', () => {
  it('mostra "Uso", o percentual e o rótulo acessível', () => {
    const html = render({ progress: 42 });

    expect(text(html)).toContain('Uso');
    expect(text(html)).toContain('42%');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="CPU: 12%"');
  });

  it('não mostra a barra sem percentual', () => {
    const html = render();

    expect(text(html)).not.toContain('Uso');
    expect(html).not.toContain('role="progressbar"');
  });

  it('colore a barra de verde até 70%', () => {
    expect(render({ progress: 70 })).toContain(cls('[&>div]:bg-emerald-500'));
    expect(render({ progress: 70 })).not.toContain(cls('[&>div]:bg-amber-500'));
  });

  it('colore a barra de âmbar entre 71% e 90%', () => {
    const html = render({ progress: 90 });

    expect(html).toContain(cls('[&>div]:bg-amber-500'));
    expect(html).not.toContain(cls('[&>div]:bg-red-500'));
  });

  it('colore a barra de vermelho acima de 90%', () => {
    const html = render({ progress: 95 });

    expect(html).toContain(cls('[&>div]:bg-red-500'));
    expect(html).not.toContain(cls('[&>div]:bg-amber-500'));
  });
});

describe('DashboardWidget — status', () => {
  it('usa o visual neutro por padrão', () => {
    const html = render();

    expect(html).toContain('bg-muted');
    expect(html).toContain('hover:border-primary/30');
    expect(html).toContain('hover:shadow-[0_0_20px_rgba(0,68,255,0.1)]');
  });

  it('usa verde para status bom', () => {
    const html = render({ status: 'good' });

    expect(html).toContain('bg-emerald-500/10');
    expect(html).toContain('text-emerald-400');
    expect(html).toContain('hover:border-emerald-500/30');
  });

  it('usa âmbar para status de atenção', () => {
    const html = render({ status: 'warning' });

    expect(html).toContain('bg-amber-500/10');
    expect(html).toContain('text-amber-400');
    expect(html).toContain('hover:border-amber-500/30');
  });

  it('usa vermelho para status crítico', () => {
    const html = render({ status: 'danger' });

    expect(html).toContain('bg-red-500/10');
    expect(html).toContain('text-red-400');
    expect(html).toContain('hover:border-red-500/30');
  });

  it('repassa classes extras sem perder as do status', () => {
    const html = render({ status: 'good', className: 'col-span-2' });

    expect(html).toContain('col-span-2');
    expect(html).toContain('bg-emerald-500/10');
  });
});
