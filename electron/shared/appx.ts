/**
 * Conhecimento estático sobre apps Appx do Windows 11: nome amigável, apps que
 * nunca podem ser removidos e a lista curada de bloatware.
 *
 * Fica no processo main (e pode ser importado por testes) para que a decisão de
 * proteção não dependa do renderer: mesmo que a UI peça, o serviço recusa.
 */

const RECOMMENDED = new Set([
  'microsoft.549981c3f5f10', // Cortana
  'microsoft.xboxgamingoverlay', // Xbox Game Bar
  'microsoft.skypeapp',
  'microsoft.bingnews',
  'microsoft.bingweather',
  'microsoft.zunemusic',
  'microsoft.zunevideo',
  'microsoft.microsoftofficehub',
  'microsoft.people',
  'microsoft.yourphone',
  'microsoft.microsoftsolitairecollection',
  'microsoft.clipchamp',
  'microsoftteams',
  'microsoft.windowsfeedbackhub',
  'microsoft.bingmaps',
  'microsoft.microsoftmaps',
  'microsoft.microsoft3dviewer',
  'microsoft.print3d',
  'microsoft.gethelp',
  'microsoft.getstarted',
  'microsoft.copilot',
  'microsoft.mixedreality.portal',
  'microsoft.oneconnect',
  'microsoft.wallet',
  'microsoft.networkspeedtest',
]);

/** Package names que nunca podem sair: o Windows depende deles. */
const PROTECTED_PACKAGES = new Set([
  'microsoft.windowsstore',
  'microsoft.desktopappinstaller', // winget
  'microsoft.windows.shellexperiencehost',
  'microsoft.windows.startmenuexperiencehost',
  'microsoft.windows.search',
  'microsoft.windows.cortana', // quando o pacote usa esse nome em vez do id numérico
  'microsoft.aad.brokerplugin',
  'microsoft.accountcontrolprovider',
  'microsoft.sechealthui',
  'microsoft.windows.sechealthui',
  'microsoft.windows.secureassessmentbrowser',
  'microsoft.windows.security',
  'microsoft.windowsdefender',
  'microsoft.windowsdefender.ui',
  'microsoft.windowsdefender.core',
  'microsoft.windows.securityhealthui',
  'microsoft.windows.storage',
  'microsoft.windows.clouddesktop',
]);

/** Prefixos de componentes compartilhados (frameworks, runtimes, shell). */
const PROTECTED_PREFIXES = [
  'microsoft.ui.xaml.',
  'microsoft.vclibs.',
  'microsoft.net.native.',
  'microsoft.services.store.',
  'microsoft.windowsappruntime.',
  'microsoft.windows.cbs.',
  'microsoft.windows.client.',
  'microsoft.windows.shell.',
  'microsoft.windows.core.',
];

/**
 * Drivers e painéis de controle de GPU. Um app assinado pelo fabricante pode
 * não vir marcado como `NonRemovable` (o pacote AMD desta máquina, por exemplo,
 * tem `SignatureKind=Developer`), então a proteção também olha o publisher.
 */
const GPU_DRIVER_PREFIXES = [
  'advancedmicrodevicesinc',
  'amd.',
  'amd-',
  'intel.',
  'intel-',
  'appup.intel',
  'nvidia.',
  'nvidia-',
  'nvidiacorp.',
  'qualcomm.',
  'arm.mali',
];

const GPU_DRIVER_PUBLISHERS = [
  'advanced micro devices',
  'intel corporation',
  'intel(r) corporation',
  'nvidia corporation',
  'qualcomm technologies',
  'arm limited',
];

/** Nomes conhecidos; o resto cai para uma versão humanizada do package name. */
const FRIENDLY_NAMES: Record<string, string> = {
  'microsoft.549981c3f5f10': 'Cortana',
  'microsoft.xboxgamingoverlay': 'Xbox Game Bar',
  'microsoft.skypeapp': 'Skype',
  'microsoft.bingnews': 'Bing News',
  'microsoft.bingweather': 'Bing Weather',
  'microsoft.zunemusic': 'Media Player',
  'microsoft.zunevideo': 'Filmes e TV',
  'microsoft.microsoftofficehub': 'Office Hub',
  'microsoft.people': 'Pessoas',
  'microsoft.yourphone': 'Link com o Celular',
  'microsoft.microsoftsolitairecollection': 'Paciência',
  'microsoft.clipchamp': 'Clipchamp',
  microsoftteams: 'Teams (consumidor)',
  'microsoft.windowsfeedbackhub': 'Hub de Comentários',
  'microsoft.bingmaps': 'Mapas',
  'microsoft.microsoftmaps': 'Mapas',
  'microsoft.microsoft3dviewer': 'Visualizador 3D',
  'microsoft.print3d': 'Imprimir 3D',
  'microsoft.gethelp': 'Obter Ajuda',
  'microsoft.getstarted': 'Dicas',
  'microsoft.copilot': 'Copilot',
  'microsoft.mixedreality.portal': 'Portal de Realidade Misturada',
  'microsoft.oneconnect': 'OneConnect',
  'microsoft.wallet': 'Carteira',
  'microsoft.networkspeedtest': 'Teste de Velocidade',
  'microsoft.windowsstore': 'Microsoft Store',
  'microsoft.desktopappinstaller': 'Instalador de Apps (winget)',
  'microsoft.windows.shellexperiencehost': 'Shell do Windows',
  'microsoft.windows.startmenuexperiencehost': 'Menu Iniciar',
  'microsoft.windows.search': 'Pesquisa do Windows',
  'microsoft.windows.notepad': 'Bloco de Notas',
  'microsoft.windowsterminal': 'Terminal do Windows',
  'microsoft.windows.photos': 'Fotos',
  'microsoft.windows.calculator': 'Calculadora',
  'microsoft.windowscamera': 'Câmera',
  'microsoft.windowsalarms': 'Relógio',
  'microsoft.windowssoundrecorder': 'Gravador de Som',
  'microsoft.screensketch': 'Ferramenta de Captura',
  'microsoft.paint': 'Paint',
  'microsoft.windowscommunicationsapps': 'Mail e Calendário',
  'microsoft.windows.devhome': 'Modo Desenvolvedor',
  'microsoft.windows.narratorquickstart': 'Narrador',
  'microsoft.windows.immersivecontrolpanel': 'Configurações',
  'microsoft.windows.secureassessmentbrowser': 'Avaliação Segura',
  'microsoft.sechealthui': 'Segurança do Windows',
  '5319275a.whatsappdesktop': 'WhatsApp',
  // Pacotes de sistema com nome GUID: o InstallLocation usa o nome real.
  '1527c705-839a-4832-9118-54d4bd6a0c89': 'Seletor de Arquivos do Windows',
  'c5e2524a-ea46-4f67-841f-6a9465d9d515': 'Explorador de Arquivos',
  'e2a4f912-2574-4a75-9bb0-0d023378592b': 'Abrir com',
  'f46d4000-fd22-4db4-ac8e-4e1ddde828fe': 'Adicionar pastas à biblioteca',
  'microsoft.windows.filepicker': 'Seletor de Arquivos do Windows',
  'microsoft.windows.fileexplorer': 'Explorador de Arquivos',
  'microsoft.windows.appresolverux': 'Abrir com',
  'microsoft.windows.addsuggestedfolderstolibrarydialog': 'Adicionar pastas à biblioteca',
  'microsoft.windows.contentdeliverymanager': 'Gerenciador de Entrega de Conteúdo',
  'microsoft.win32webviewhost': 'Host de WebView do Windows',
  'microsoft.aad.brokerplugin': 'Plugin de Conta da Microsoft',
  'microsoft.accountscontrol': 'Controle de Contas',
  'microsoft.accountcontrol': 'Controle de Contas',
  'microsoft.asynctextservice': 'Serviço de Texto Assíncrono',
  'microsoft.creddialoghost': 'Janela de Credenciais',
  'microsoft.lockapp': 'Tela de Bloqueio',
  'microsoft.windows.peopleexperiencehost': 'Pessoas',
  'microsoft.windows.parentalcontrols': 'Controle dos Pais',
  'microsoft.windows.printqueueactioncenter': 'Central de Impressão',
  'microsoft.windows.xgpuejectdialog': 'Remoção de GPU Externa',
  'microsoft.xboxgamecallableui': 'Interface do Xbox',
  'microsoft.xboxidentityprovider': 'Provedor de Identidade Xbox',
  'microsoft.av1videoextension': 'Extensão de Vídeo AV1',
  'microsoft.storepurchaseapp': 'Compra da Store',
  'microsoft.gamingservices': 'Serviços de Jogos',
  'windows.cbspreview': 'Componente de Servicing (CBS)',
  // Drivers e painéis de controle de GPU (geralmente com DisplayName ms-resource).
  'advancedmicrodevicesinc-rsxcm': 'AMD Radeon Settings',
  'advancedmicrodevicesinc-2.amdradeonsoftware': 'AMD Software: Adrenalin Edition',
  'appup.intelgraphicsexperience': 'Central de Gráficos Intel',
  'nvidiacorp.nvidiacontrolpanel': 'Painel de Controle NVIDIA',
};

const PROTECTED_REASON = 'Componente essencial do Windows';
const FRAMEWORK_REASON = 'Framework compartilhado por outros apps';
const NON_REMOVABLE_REASON = 'Marcado pelo Windows como não removível';
const GPU_DRIVER_REASON = 'Driver/componente de placa de vídeo';
const UNKNOWN_GUID_REASON = 'Componente do Windows';

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNRESOLVED_NAME_PATTERN = /^ms-resource:/i;

function normalize(packageName: string): string {
  return packageName.trim().toLowerCase();
}

export function isGuidPackageName(packageName: string): boolean {
  return GUID_PATTERN.test(packageName.trim());
}

function humanizePackageName(packageName: string): string {
  const stripped = packageName.replace(/^Microsoft\./i, '').replace(/^Windows\./i, '');
  const humanized = stripped
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return humanized || packageName;
}

/** `ms-resource:...` é uma referência não resolvida: não serve como nome. */
function usableDisplayName(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || UNRESOLVED_NAME_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

/**
 * Pastas de pacotes de sistema terminam com `_<publisher hash>`
 * (`Microsoft.Windows.FilePicker_cw5n1h2txyewy`). É daí que sai o nome real dos
 * pacotes cujo `Name` é um GUID.
 */
function folderPackageName(location?: string): string | undefined {
  const trimmed = location?.trim();
  if (!trimmed) return undefined;

  const segment = trimmed.split(/[\\/]/).filter(Boolean).pop();
  if (!segment) return undefined;

  return segment.replace(/_[a-z0-9]+$/i, '') || undefined;
}

export interface AppxNameInput {
  packageName: string;
  /** `Package.Properties.DisplayName` do manifesto (pode vir `ms-resource:`). */
  displayName?: string;
  /** `DisplayName` de `Get-AppxProvisionedPackage`; último recurso antes da humanização. */
  provisionedDisplayName?: string;
  /** `InstallLocation`; resolve pacotes cujo `Name` é GUID. */
  installLocation?: string;
}

/**
 * Nome exibido no inventário.
 *
 * Precedência: nome curado → DisplayName do manifesto → nome curado da pasta →
 * DisplayName do provisionado → humanização. Apps com `Name` GUID nunca mostram
 * o GUID: saem pelo nome da pasta ou como "Componente do Windows".
 */
export function appxDisplayName(input: AppxNameInput): string {
  const packageName = input.packageName.trim();
  const curated = FRIENDLY_NAMES[normalize(packageName)];
  if (curated) return curated;

  const fromManifest = usableDisplayName(input.displayName);
  if (fromManifest) return fromManifest;

  const isGuid = isGuidPackageName(packageName);
  const folderName = isGuid ? folderPackageName(input.installLocation) : undefined;

  if (folderName) {
    const curatedFolder = FRIENDLY_NAMES[normalize(folderName)];
    if (curatedFolder) return curatedFolder;
  }

  const fromProvisioned = usableDisplayName(input.provisionedDisplayName);
  if (fromProvisioned) return fromProvisioned;

  if (isGuid) {
    return folderName ? humanizePackageName(folderName) : UNKNOWN_GUID_REASON;
  }

  return humanizePackageName(packageName);
}

export function isRecommendedAppx(packageName: string): boolean {
  return RECOMMENDED.has(normalize(packageName));
}

export interface AppxProtectionInput {
  packageName: string;
  isFramework?: boolean;
  nonRemovable?: boolean;
  /** Publisher do certificado (`CN=…`) — pega drivers de GPU com nomes genéricos. */
  publisher?: string;
}

/** Motivo pelo qual o app nunca pode ser removido, ou undefined se é removível. */
export function appxProtectionReason(input: AppxProtectionInput): string | undefined {
  if (input.isFramework) return FRAMEWORK_REASON;
  if (input.nonRemovable) return NON_REMOVABLE_REASON;

  const name = normalize(input.packageName);
  if (PROTECTED_PACKAGES.has(name)) return PROTECTED_REASON;
  if (PROTECTED_PREFIXES.some((prefix) => name.startsWith(prefix))) return PROTECTED_REASON;

  if (GPU_DRIVER_PREFIXES.some((prefix) => name.startsWith(prefix))) return GPU_DRIVER_REASON;

  const publisher = input.publisher ? input.publisher.toLowerCase() : '';
  if (GPU_DRIVER_PUBLISHERS.some((vendor) => publisher.includes(vendor))) {
    return GPU_DRIVER_REASON;
  }

  return undefined;
}
