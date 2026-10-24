const LEVE = [
  'com.android.chrome',
  'com.android.htmlviewer',
  'com.android.bookmarkprovider',
  'com.android.printservice.recommendation',
  'com.android.wallpaperpicker',
  'com.android.wallpaper.livepicker',
  'com.android.wallpapercropper',
  'com.android.traceur',
] as const;

const RECOMENDADO = [
  ...LEVE,
  'com.android.calculator2',
  'com.android.documentsui',
  'com.android.printspooler',
  'com.android.bips',
  'com.android.storagemanager',
  'com.android.companiondevicemanager',
  'com.android.providers.downloads.ui',
  'com.android.providers.blockednumber',
  'com.android.settings.intelligence',
  'com.android.systemui.theme.dark',
  'com.android.backupconfirm',
  'com.android.captiveportallogin',
  'com.android.simappdialog',
  'com.android.carrierconfig',
  'com.android.carrierdefaultapp',
  'com.android.onetimeinitializer',
  'com.google.android.backuptransport',
  'com.google.android.partnersetup',
  'com.google.android.gms.setup',
  'com.google.android.onetimeinitializer',
  'com.google.android.syncadapters.contacts',
] as const;

const MAXIMO = [
  ...RECOMENDADO,
  'com.android.pacprocessor',
  'com.android.certinstaller',
  'com.android.provision',
  'com.android.sharedstoragebackup',
  'com.android.statementservice',
  'com.android.cts.ctsshim',
  'com.android.cts.priv.ctsshim',
  'com.android.internal.display.cutout.emulation.corner',
  'com.android.internal.display.cutout.emulation.double',
  'com.android.internal.display.cutout.emulation.tall',
] as const;

export const PRESETS = {
  leve: {
    name: 'Leve',
    description: 'Extras Google: navegador, papel de parede e impressão',
    packages: LEVE,
  },
  recomendado: {
    name: 'Recomendado',
    description: 'Utilitários do sistema e sincronização do Google',
    packages: RECOMENDADO,
  },
  maximo: {
    name: 'Máximo',
    description: 'Todos os pré-instalados que não são críticos',
    packages: MAXIMO,
  },
} as const;

export type PresetKey = keyof typeof PRESETS;

export const BLOATWARE_PACKAGES = new Set<string>([...LEVE, ...RECOMENDADO, ...MAXIMO]);
