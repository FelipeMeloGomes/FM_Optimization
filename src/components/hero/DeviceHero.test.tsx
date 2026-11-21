// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeviceHero } from './DeviceHero';

describe('DeviceHero', () => {
  it('mostra a foto, o selo, o título e a descrição animada', () => {
    render(
      <DeviceHero
        badge="Ferramentas"
        path="/armazenamento"
        title="Armazenamento"
        description="Libere espaço em disco e otimize o SSD."
        image="/storage.jpg"
        imageAlt="Unidades HD e SSD"
      />
    );

    expect(screen.getByRole('img', { name: 'Unidades HD e SSD' })).toBeDefined();
    expect(document.querySelector('svg')?.className.baseVal).toContain('lucide-hard-drive');
    expect(screen.getByText('Ferramentas')).toBeDefined();
    expect(screen.getByText('Armazenamento')).toBeDefined();
    expect((document.body.textContent ?? '').replace(/\s+/g, ' ')).toContain(
      'Libere espaço em disco e otimize o SSD.'
    );
  });
});
