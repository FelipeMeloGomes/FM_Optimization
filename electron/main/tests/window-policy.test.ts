import { describe, expect, it } from 'vitest';
import {
  applyChromiumBackgroundSwitches,
  CHROMIUM_BACKGROUND_SWITCHES,
  canFocus,
  resolveCloseAction,
  shouldCreateMissingWindow,
  shouldCreateWindowAtBoot,
  shouldShowWindow,
} from '../window-policy';

/**
 * A janela principal custa ~180 MB (renderer + GPU). Estas decisões definem
 * quando ela existe; errar aqui significa ou vazar memória no login ou deixar
 * o app inalcançável na bandeja.
 */
describe('shouldCreateWindowAtBoot', () => {
  it('cria a janela numa abertura normal', () => {
    expect(shouldCreateWindowAtBoot(['app.exe'])).toBe(true);
  });

  it('nao cria a janela quando o autostart pede --hidden', () => {
    expect(shouldCreateWindowAtBoot(['app.exe', '--hidden'])).toBe(false);
  });

  it('cria a janela com --hidden quando ha script elevado pendente', () => {
    expect(shouldCreateWindowAtBoot(['app.exe', '--hidden', '--elevate-script', 'cleaner-1'])).toBe(
      true
    );
  });

  it('cria a janela com --hidden quando ha aplicacao de DNS elevada', () => {
    expect(
      shouldCreateWindowAtBoot(['app.exe', '--hidden', '--elevate-dns', '7', '["1.1.1.1"]'])
    ).toBe(true);
  });
});

describe('shouldShowWindow', () => {
  it('esconde a janela criada no boot com --hidden', () => {
    expect(shouldShowWindow('boot', true)).toBe(false);
  });

  it('mostra a janela criada no boot sem --hidden', () => {
    expect(shouldShowWindow('boot', false)).toBe(true);
  });

  it('mostra a janela criada sob demanda mesmo com --hidden no processo', () => {
    // Sem isso, clicar na bandeja depois do autostart criaria uma janela
    // invisivel: o processo nasceu com --hidden e nunca chamaria show().
    expect(shouldShowWindow('on-demand', true)).toBe(true);
  });
});

describe('resolveCloseAction', () => {
  it('destroi a janela ao fechar com a bandeja ativa', () => {
    expect(resolveCloseAction(false, true)).toBe('destroy');
  });

  it('deixa o Electron fechar normalmente sem bandeja', () => {
    expect(resolveCloseAction(false, false)).toBe('allow-close');
  });

  it('nao intercepta o fechamento quando o app esta encerrando', () => {
    expect(resolveCloseAction(true, true)).toBe('allow-close');
  });
});

describe('shouldCreateMissingWindow', () => {
  it('nao abre janela no boot oculto sem bandeja', () => {
    // Era o bug: sem bandeja o app recriava a janela incondicionalmente e o
    // `--hidden` do autostart abria a UI (~400 MB em vez de ~180 MB).
    expect(shouldCreateMissingWindow({ startedHidden: true, windowWasCreated: false })).toBe(false);
  });

  it('recria a janela quando a bandeja e desligada com a janela ja fechada', () => {
    // Sem bandeja e sem janela o app ficaria rodando inalcancavel.
    expect(shouldCreateMissingWindow({ startedHidden: true, windowWasCreated: true })).toBe(true);
  });

  it('recria a janela num boot visivel', () => {
    expect(shouldCreateMissingWindow({ startedHidden: false, windowWasCreated: false })).toBe(true);
  });
});

describe('canFocus', () => {
  it('recusa janela inexistente', () => {
    expect(canFocus(null)).toBe(false);
  });

  it('recusa janela destruida em vez de estourar ao focar', () => {
    expect(canFocus({ isDestroyed: () => true })).toBe(false);
  });

  it('aceita janela viva', () => {
    expect(canFocus({ isDestroyed: () => false })).toBe(true);
  });
});

describe('applyChromiumBackgroundSwitches', () => {
  it('aplica todos os switches de background, uma vez cada', () => {
    const applied: string[] = [];
    applyChromiumBackgroundSwitches({ appendSwitch: (name) => applied.push(name) });

    expect(applied).toEqual([...CHROMIUM_BACKGROUND_SWITCHES]);
    expect(new Set(applied).size).toBe(applied.length);
  });

  it('nao desliga a rede do proprio app nem o updater', () => {
    // --disable-gpu e --single-process economizariam memoria mas quebram
    // rasterizacao e sandbox; o update precisa de rede para funcionar.
    expect(CHROMIUM_BACKGROUND_SWITCHES).not.toContain('disable-gpu');
    expect(CHROMIUM_BACKGROUND_SWITCHES).not.toContain('single-process');
    expect(CHROMIUM_BACKGROUND_SWITCHES).not.toContain('disable-features');
  });

  it('passa nomes de switch sem os hifens iniciais', () => {
    for (const sw of CHROMIUM_BACKGROUND_SWITCHES) {
      expect(sw.startsWith('-')).toBe(false);
    }
  });
});
