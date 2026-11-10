import { describe, expect, it } from 'vitest';
import type { AppSettings } from '../../electron/shared/ipc-types';
import { ALWAYS_VISIBLE_ROUTES, isPageLocked } from './page-lock';

/**
 * `isPageLocked` é o portão que decide se a rota é liberada. Os testes de rotas
 * só garantem que as listas batem; estes cobrem a decisão em si, incluindo as
 * duas rotas que nunca podem ser bloqueadas (senão o usuário se tranca fora).
 */

function settings(pageLock: Partial<AppSettings['pageLock']>): AppSettings {
  return {
    pageLock: {
      enabled: false,
      salt: '',
      passwordHashCipher: '',
      lockedPages: [],
      unlocked: false,
      ...pageLock,
    },
  } as AppSettings;
}

describe('isPageLocked', () => {
  it('libera tudo quando o recurso está desligado', () => {
    const s = settings({ enabled: false, lockedPages: ['/cpu'] });

    expect(isPageLocked('/cpu', s)).toBe(false);
  });

  it('bloqueia uma página marcada enquanto não foi desbloqueada', () => {
    const s = settings({ enabled: true, lockedPages: ['/cpu'], unlocked: false });

    expect(isPageLocked('/cpu', s)).toBe(true);
  });

  it('libera a página depois do desbloqueio da sessão', () => {
    const s = settings({ enabled: true, lockedPages: ['/cpu'], unlocked: true });

    expect(isPageLocked('/cpu', s)).toBe(false);
  });

  it('não bloqueia páginas fora da lista', () => {
    const s = settings({ enabled: true, lockedPages: ['/cpu'], unlocked: false });

    expect(isPageLocked('/rede', s)).toBe(false);
  });

  it('nunca bloqueia o dashboard nem as configurações', () => {
    const s = settings({
      enabled: true,
      lockedPages: [...ALWAYS_VISIBLE_ROUTES],
      unlocked: false,
    });

    for (const route of ALWAYS_VISIBLE_ROUTES) {
      expect(isPageLocked(route, s), route).toBe(false);
    }
  });

  it('ignora uma lista vazia', () => {
    const s = settings({ enabled: true, lockedPages: [], unlocked: false });

    expect(isPageLocked('/cpu', s)).toBe(false);
  });
});
