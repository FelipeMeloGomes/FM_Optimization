// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroBanner, HeroDescription } from './HeroBanner';

describe('HeroBanner', () => {
  it('mostra a ilustração inteira, o selo, o título e a descrição animada', () => {
    render(
      <HeroBanner
        image="/x.svg"
        imageAlt="Ilustração de teste"
        badge="Ferramentas"
        path="/armazenamento"
        title="Armazenamento"
        description="Libere espaço em disco."
      />
    );

    const img = screen.getByRole('img', { name: 'Ilustração de teste' });
    expect(img.className).toContain('object-contain');
    expect(img.className).not.toContain('object-cover');
    expect(document.querySelector('.bg-gradient-to-br')?.getAttribute('style')).toContain(
      'height: 12rem'
    );
    expect(document.querySelector('svg')?.className.baseVal).toContain('lucide-hard-drive');
    expect(screen.getByText('Ferramentas')).toBeDefined();
    expect(screen.getByText('Armazenamento')).toBeDefined();
    expect((document.body.textContent ?? '').replace(/\s+/g, ' ')).toContain(
      'Libere espaço em disco.'
    );
  });

  it('mantém o conteúdo extra passado como children', () => {
    render(
      <HeroBanner image="/x.svg" imageAlt="Ilustração de teste">
        <div>Conteúdo dinâmico</div>
      </HeroBanner>
    );
    expect(screen.getByText('Conteúdo dinâmico')).toBeDefined();
  });

  it('revela a descrição extra palavra por palavra, como no ramo padrão', () => {
    const { container } = render(<HeroDescription text="Limpeza rápida e segura." />);

    expect(screen.getByText('Limpeza rápida e segura.')).toBeDefined();
    expect(container.querySelectorAll('.inline-flex').length).toBe(4);
    expect(container.querySelector('.blur-text')?.className).toContain('max-w-lg');
  });

  it('estica o conteúdo extra e o alinha à esquerda, sem deixar a casca centralizá-lo', () => {
    render(
      <HeroBanner image="/x.svg" imageAlt="Ilustração de teste">
        <div>Conteúdo dinâmico</div>
      </HeroBanner>
    );

    const wrapper = screen.getByText('Conteúdo dinâmico').parentElement;
    expect(wrapper?.className).toContain('w-full');
    expect(wrapper?.className).toContain('self-stretch');
    expect(wrapper?.className).toContain('flex');
    expect(wrapper?.className).toContain('items-center');
  });

  it('aceita classes próprias no contêiner e no conteúdo', () => {
    const { container } = render(
      <HeroBanner
        image="/x.svg"
        imageAlt="Ilustração de teste"
        className="border-success/20 bg-gradient-to-br to-transparent"
        contentClassName="p-4"
      >
        <p>Desempenho</p>
      </HeroBanner>
    );

    const shell = container.firstElementChild;
    expect(shell?.className).toContain('border-success/20');
    expect(shell?.className).not.toContain('border-primary/20');
    expect(shell?.querySelector('.p-4')).not.toBeNull();
  });
});
