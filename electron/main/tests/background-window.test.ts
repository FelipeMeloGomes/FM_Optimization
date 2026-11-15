import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HIDDEN_ARG } from '../window-policy';

/**
 * Testes de fiação: as decisões estão em `window-policy.ts` (cobertas por
 * `window-policy.test.ts`), mas quem as usa é o `index.ts`. Um `createWindow()`
 * incondicional ou um `hide()` de volta ao fechar custa ~180 MB em segundo
 * plano — e nenhum teste de unidade pegaria isso.
 */

const source = readFileSync(join(process.cwd(), 'electron', 'main', 'index.ts'), 'utf8');

function indexOfOrFail(needle: string): number {
  const at = source.indexOf(needle);
  expect(at, `esperado encontrar "${needle}" em electron/main/index.ts`).toBeGreaterThan(-1);
  return at;
}

describe('janela em segundo plano', () => {
  it('aplica os switches do Chromium antes de app.whenReady', () => {
    const switches = indexOfOrFail('applyChromiumBackgroundSwitches(app.commandLine)');
    const ready = indexOfOrFail('await app.whenReady()');

    expect(switches).toBeLessThan(ready);
  });

  it('nao cria janela no boot quando o processo subiu com --hidden', () => {
    expect(source).toContain(`process.argv.includes('${HIDDEN_ARG}')`);
    expect(source).toContain("if (shouldCreateWindowAtBoot(process.argv)) createWindow('boot')");
  });

  it('cria a janela antes de disparar a tarefa elevada', () => {
    const create = indexOfOrFail(
      "if (shouldCreateWindowAtBoot(process.argv)) createWindow('boot')"
    );
    const elevated = indexOfOrFail('handleElevatedScript();');

    expect(create).toBeLessThan(elevated);
  });

  it('destroi a janela ao fechar em vez de esconder', () => {
    expect(source).toContain('resolveCloseAction(appState.isQuitting, isTrayActive())');
    expect(source).toContain('window.destroy()');
    // `hide()` mantinha renderer (+65 MB) e processo GPU (+115 MB) vivos.
    expect(source).not.toMatch(/mainWindow\?\.hide\(\)/);
    expect(source).not.toMatch(/mainWindow\.hide\(\)/);
  });

  it('zera a referencia quando a janela e fechada de verdade', () => {
    // Sem isso, o proximo clique na bandeja chama show() em objeto destruido.
    expect(source).toMatch(/on\('closed', \(\) => \{[\s\S]{0,200}mainWindow = null/);
  });

  it('abre a janela sob demanda pela bandeja, segunda instancia e activate', () => {
    expect(source).toContain('onOpen: () => openMainWindow()');
    expect(source).toContain('void app.whenReady().then(openMainWindow)');
    expect(source).toMatch(/on\('activate', \(\) => \{[\s\S]{0,120}openMainWindow\(\)/);
  });

  it('recria a janela se a bandeja for desligada com a janela destruida', () => {
    // Sem bandeja e sem janela o app ficaria rodando inalcancavel.
    expect(source).toMatch(
      /if \(!canFocus\(mainWindow\)\) \{[\s\S]{0,120}createWindow\('on-demand'\)/
    );
  });

  it('desliga o corretor ortografico sem tocar na sessao padrao', () => {
    expect(source).toContain('spellcheck: false');
    // Acessar `session.defaultSession` faz o Chromium criar um renderer
    // (~20 MB) mesmo sem janela — o oposto do objetivo aqui.
    expect(source).not.toContain('session.defaultSession');
  });

  it('nao aplica switches soltos fora do modulo de politica', () => {
    // A command line do Chromium precisa ser unica e auditavel num so lugar.
    expect(source).not.toContain('appendSwitch(');
    expect(source).toContain('applyChromiumBackgroundSwitches(app.commandLine)');
  });
});
