/**
 * Programas da pagina "App Essenciais PC".
 *
 * Cada programa e so uma entrada aqui: a UI e generica. Todos sao instalados
 * pelo winget, que baixa do canal oficial do fornecedor e valida o hash do
 * manifesto antes de rodar o instalador.
 */
export interface EssentialProgram {
  id: string;
  name: string;
  description: string;
  /** Pagina oficial, usada pelo link "Pagina oficial". */
  pageUrl: string;
  /** Id exato do pacote no winget. */
  packageId: string;
  warning?: string;
}

export const ESSENTIAL_PROGRAMS: EssentialProgram[] = [
  {
    id: 'cpu-z',
    name: 'CPU-Z',
    description:
      'Identifica processador, placa-mãe, memória e placa de vídeo. Traz benchmark e validação de overclock.',
    pageUrl: 'https://www.cpuid.com/softwares/cpu-z.html',
    packageId: 'CPUID.CPU-Z',
  },
  {
    id: 'hwmonitor',
    name: 'HWMonitor',
    description:
      'Mostra temperaturas, voltagens e rotação das ventoinhas do PC em tempo real, com histórico de picos.',
    pageUrl: 'https://www.cpuid.com/softwares/hwmonitor.html',
    packageId: 'CPUID.HWMonitor',
  },
  {
    id: 'msi-afterburner',
    name: 'MSI Afterburner',
    description: 'Overclock de GPU, curvas de ventoinha e monitoramento em tempo real.',
    pageUrl: 'https://www.msi.com/Landing/afterburner',
    packageId: 'Guru3D.Afterburner',
    warning:
      'Overclock e curva de ventoinha podem causar instabilidade. Suba as frequências aos poucos e teste antes de salvar.',
  },
  {
    id: '7-zip',
    name: '7-Zip',
    description:
      'Compacta e extrai 7z, ZIP, RAR e outros formatos, com integração ao menu de contexto do Explorer. Gratuito e de código aberto.',
    pageUrl: 'https://www.7-zip.org/',
    packageId: '7zip.7zip',
  },
  {
    id: 'winrar',
    name: 'WinRAR',
    description:
      'Compacta e extrai RAR, ZIP e outros formatos, com reparo de arquivos corrompidos. A versão de avaliação dura 40 dias; a licença é paga para uso contínuo.',
    pageUrl: 'https://www.win-rar.com/',
    packageId: 'RARLab.WinRAR',
  },
  {
    id: 'bcuninstaller',
    name: 'BCUninstaller',
    description:
      'Remove programas em lote, inclusive os que não aparecem em "Aplicativos e recursos", e mostra quanto de espaço deve sobrar depois da desinstalação.',
    pageUrl: 'https://bcuninstaller.org/',
    packageId: 'Klocman.BulkCrapUninstaller',
    warning:
      'É um desinstalador de verdade: revise a lista antes de confirmar e não remova componentes do próprio Windows.',
  },
];

export function getEssentialProgram(id: string): EssentialProgram | undefined {
  return ESSENTIAL_PROGRAMS.find((program) => program.id === id);
}
