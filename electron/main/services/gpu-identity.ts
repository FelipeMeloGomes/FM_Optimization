/**
 * Normalização do nome da placa de vídeo.
 *
 * O WMI (`Win32_VideoController.Name`) devolve o nome exatamente como o driver
 * o registra: alguns fabricantes incluem marcas registradas, sufixos de linha
 * ("Series") e o tipo de dispositivo ("Laptop GPU"). A UI só precisa de
 * `Fabricante + Linha + Modelo`, então a limpeza vive aqui e é aplicada uma
 * única vez no main process.
 *
 * O modelo nunca é reescrito: `RTX 4070 Ti SUPER`, `RX 7600 XT` e `Arc A770`
 * continuam intactos, assim como `Graphics`, que faz parte do nome comercial
 * das iGPUs da Intel e da AMD.
 */

/** Padding do WMI e quebras de linha não podem vazar para a UI. */
export function trimGpuName(value?: string): string {
  return (value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converte o nome bruto da GPU no padrão `Fabricante + Linha + Modelo`.
 *
 * A ordem importa: as marcas registradas saem antes do sufixo de forma física,
 * e o `Series` antes do `GPU` — assim `Radeon RX 580 Series` e
 * `GeForce RTX 3060 Laptop GPU` chegam ao mesmo formato curto.
 */
export function formatGpuName(value?: string): string {
  const trimmed = trimGpuName(value);
  if (!trimmed) return 'N/A';

  // "Intel(R) UHD Graphics 630" → "Intel UHD Graphics 630"
  let name = trimmed.replace(/\s*\((?:R|TM|C)\)\s*/gi, ' ');

  // "NVIDIA GeForce GTX 1650 with Max-Q Design" → "NVIDIA GeForce GTX 1650"
  name = name.replace(/\s+(?:with|w\/)\s+.*$/i, '');

  // "AMD Radeon RX 580 Series" → "AMD Radeon RX 580"
  name = name.replace(/\s+series$/i, '');

  // "NVIDIA GeForce RTX 3060 Laptop GPU" → "NVIDIA GeForce RTX 3060 Laptop"
  name = name.replace(/\s+gpu$/i, '');

  name = name.replace(/\s+/g, ' ').trim();

  // Rede de segurança: nenhuma regra pode transformar um nome válido em vazio.
  return name.length >= 3 ? name : trimmed;
}
