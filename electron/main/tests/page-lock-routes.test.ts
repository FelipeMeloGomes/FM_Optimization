import { describe, expect, it } from 'vitest';
import { migrateLockedPages } from '../page-lock-routes';

/**
 * `/tweaks` e `/apps` sumiram na reorganizacao. Um `lockedPages` gravado por
 * uma versao anterior precisa continuar bloqueando as paginas equivalentes —
 * desbloquear em silencio seria a pior falha possivel aqui.
 */
describe('migrateLockedPages', () => {
  it('nao mexe em uma lista que ja so tem rotas atuais', () => {
    const result = migrateLockedPages(['/emuladores', '/cpu', '/personalizacao']);
    expect(result.lockedPages).toEqual(['/emuladores', '/cpu', '/personalizacao']);
    expect(result.changed).toBe(false);
  });

  it('expande /tweaks para todas as paginas que herdaram os scripts', () => {
    const result = migrateLockedPages(['/tweaks']);
    expect(result.lockedPages).toEqual(['/cpu', '/rede', '/utilities', '/personalizacao']);
    expect(result.changed).toBe(true);
  });

  it('converte /apps para a pagina de Privacidade', () => {
    const result = migrateLockedPages(['/apps']);
    expect(result.lockedPages).toEqual(['/privacidade-seguranca']);
    expect(result.changed).toBe(true);
  });

  it('preserva as rotas atuais e nao duplica destinos ja bloqueados', () => {
    const result = migrateLockedPages(['/emuladores', '/tweaks', '/cpu', '/apps']);
    expect(result.lockedPages).toEqual([
      '/emuladores',
      '/cpu',
      '/rede',
      '/utilities',
      '/personalizacao',
      '/privacidade-seguranca',
    ]);
    expect(result.changed).toBe(true);
  });

  it('mantem rotas desconhecidas intactas em vez de descartar ou mandar para /', () => {
    const result = migrateLockedPages(['/rota-que-nao-existe', '/tweaks']);
    expect(result.lockedPages).toEqual([
      '/rota-que-nao-existe',
      '/cpu',
      '/rede',
      '/utilities',
      '/personalizacao',
    ]);
    expect(result.changed).toBe(true);
  });

  it('e idempotente: rodar de novo nao altera e nao regrava', () => {
    const first = migrateLockedPages(['/tweaks', '/apps']);
    const second = migrateLockedPages(first.lockedPages);
    expect(second.changed).toBe(false);
    expect(second.lockedPages).toEqual(first.lockedPages);
  });

  it('remove duplicatas ja existentes sem mudar a ordem', () => {
    const result = migrateLockedPages(['/cpu', '/cpu', '/apps', '/apps']);
    expect(result.lockedPages).toEqual(['/cpu', '/privacidade-seguranca']);
    expect(result.changed).toBe(true);
    expect(migrateLockedPages(result.lockedPages).changed).toBe(false);
  });

  it('lida com lista vazia', () => {
    expect(migrateLockedPages([])).toEqual({ lockedPages: [], changed: false });
  });
});
