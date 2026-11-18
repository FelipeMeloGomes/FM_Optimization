import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `index.ts` importava `execPowerShellSafe` com `await import(...)` achando que
 * adiava o carregamento do módulo. Mas `ipc-handlers` importa `powershell`
 * estaticamente e é importado por `index.ts` no boot — o módulo já estava no
 * bundle inicial e o Vite/Rolldown emitia `INEFFECTIVE_DYNAMIC_IMPORT`.
 * Este teste trava o contrato: o import deve ser estático.
 */

const repoRoot = process.cwd();

describe('import de powershell no main', () => {
  it('index.ts importa powershell de forma estática, sem import dinâmico', () => {
    const source = readFileSync(join(repoRoot, 'electron/main/index.ts'), 'utf8');
    const dynamicImport = source.match(/import\(\s*['"]\.\/services\/powershell['"]\s*\)/);

    expect(dynamicImport, 'index.ts não deve importar powershell dinamicamente').toBeNull();
    expect(source).toContain("from './services/powershell'");
  });
});
