import { describe, expect, it } from 'vitest';
import { ESSENTIAL_PROGRAMS, getEssentialProgram } from '../../shared/essentials';

/**
 * A pagina "Essenciais PC" e generica: cada programa e so uma linha neste
 * catalogo e o `installEssential` monta o winget a partir do `packageId`. Um id
 * duplicado sobrescreveria o outro na UI e um `packageId` errado so apareceria
 * quando o usuario clicasse em instalar, entao as invariantes ficam aqui.
 */
describe('catalogo de programas essenciais', () => {
  it('tem ids unicos e nao vazios', () => {
    const ids = ESSENTIAL_PROGRAMS.map((program) => program.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.trim() === '')).toEqual([]);
  });

  it('todo programa traz nome, descricao, pagina oficial e packageId do winget', () => {
    for (const program of ESSENTIAL_PROGRAMS) {
      expect(program.name.trim(), program.id).not.toBe('');
      expect(program.description.trim(), program.id).not.toBe('');
      expect(program.pageUrl, program.id).toMatch(/^https:\/\//);
      // Id de winget: sem espacos, com pelo menos um ponto (Publisher.Package).
      expect(program.packageId, program.id).toMatch(/^\S+\.\S+$/);
    }
  });

  it('o DirectX usa o pacote oficial Microsoft.DirectX e abre a pagina da Microsoft', () => {
    const directx = getEssentialProgram('directx');
    expect(directx?.packageId).toBe('Microsoft.DirectX');
    expect(directx?.pageUrl).toBe('https://www.microsoft.com/download/details.aspx?id=35');
  });
});
