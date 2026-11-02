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

  it('apresenta o DirectX como runtime legado, nao como atualizacao do DirectX 12', () => {
    // `winget show Microsoft.DirectX` descreve o pacote como runtime libraries
    // do DirectX SDK legado (D3DX9/10/11, XAudio 2.7, XInput 1.3, XACT e
    // Managed DirectX 1.1), com instalador MSIX. O card nao pode prometer uma
    // versao nova do DirectX que o Windows ja traz.
    const directx = getEssentialProgram('directx');
    expect(directx?.name).toMatch(/legado/i);
    expect(directx?.description).toMatch(/legado/i);
    expect(directx?.description).toMatch(/não atualiza o DirectX 12/i);
    expect(directx?.description).toMatch(/D3DX9/);
  });

  it('nao afirma que o instalador oferece software extra sem confirmacao', () => {
    // O aviso antigo citava a Bing Bar, mas o pacote atual e um MSIX assinado
    // (UAPSignedBinary_Microsoft.DirectX.x64.appx) sem ofertas adicionais.
    const warning = getEssentialProgram('directx')?.warning ?? '';
    expect(warning).not.toMatch(/bing|barra|software extra|desmarque/i);
    expect(warning).toMatch(/d3dx9/i);
  });
});
