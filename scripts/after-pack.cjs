const { existsSync, rmSync } = require('node:fs');
const { join } = require('node:path');

/**
 * Arquivos do runtime do Electron que este app não usa.
 *
 * `dxcompiler.dll` (DXC) só é carregado pelo caminho WebGPU/D3D12. O renderer
 * aqui usa D3D11 + `D3DCompiler_47.dll`, então o DXC são 24,6 MB de peso morto
 * dentro de todo instalador. `vk_swiftshader`/`vulkan-1` ficam: são o fallback
 * de GPU para máquinas sem driver.
 */
const UNUSED_RUNTIME_FILES = ['dxcompiler.dll'];

/**
 * Remove os arquivos listados de `appOutDir`. Idempotente: se o arquivo não
 * existir, segue em frente sem lançar.
 *
 * @param {{ appOutDir: string }} context
 * @returns {string[]} nomes efetivamente removidos
 */
function removeUnusedRuntime(context) {
  const removed = [];

  for (const file of UNUSED_RUNTIME_FILES) {
    const target = join(context.appOutDir, file);
    if (!existsSync(target)) continue;
    rmSync(target, { force: true });
    removed.push(file);
  }

  return removed;
}

/**
 * Hook `afterPack` do electron-builder. Roda depois de copiar o runtime do
 * Electron e antes de gerar o instalador.
 *
 * @param {{ appOutDir: string, electronPlatformName: string }} context
 */
async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const removed = removeUnusedRuntime(context);
  if (removed.length > 0) {
    console.log(`  • removidos do pacote: ${removed.join(', ')}`);
  }
}

module.exports = afterPack;
module.exports.removeUnusedRuntime = removeUnusedRuntime;
module.exports.UNUSED_RUNTIME_FILES = UNUSED_RUNTIME_FILES;

