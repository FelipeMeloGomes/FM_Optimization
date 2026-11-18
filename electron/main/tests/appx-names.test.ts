import { describe, expect, it } from 'vitest';
import { appxDisplayName } from '../../shared/appx';

/**
 * Nomes exibidos no inventário.
 *
 * O Windows já carrega o nome real no manifesto (`Package.Properties.DisplayName`)
 * e, para os pacotes de sistema com nome GUID, o `InstallLocation` aponta para a
 * pasta com o nome verdadeiro. Os casos abaixo vieram de uma varredura real no
 * Windows 11: humanizar o package name produzia "5319275A WhatsApp Desktop",
 * "Language Experience Packen-US" e um GUID quebrado.
 */
describe('appxDisplayName — nome do manifesto', () => {
  it('usa o DisplayName do manifesto em vez de humanizar o package name', () => {
    expect(
      appxDisplayName({
        packageName: '5319275A.WhatsAppDesktop',
        displayName: 'WhatsApp',
        installLocation:
          'C:\\Program Files\\WindowsApps\\5319275A.WhatsAppDesktop_2.2504.3.0_x64__cv1g1gvanyjgm',
      })
    ).toBe('WhatsApp');
  });

  it('separa corretamente o sufixo do Language Experience Pack', () => {
    expect(
      appxDisplayName({
        packageName: 'Microsoft.LanguageExperiencePacken-US',
        displayName: 'English (United States) Local Experience Pack',
        installLocation:
          'C:\\Windows\\SystemApps\\Microsoft.LanguageExperiencePacken-US_8wekyb3d8bbwe',
      })
    ).toBe('English (United States) Local Experience Pack');
  });

  it('ignora DisplayName não resolvido (ms-resource:) e cai no fallback', () => {
    expect(
      appxDisplayName({
        packageName: 'Microsoft.SkypeApp',
        displayName: 'ms-resource:AppName',
      })
    ).toBe('Skype');
  });

  it('prefere o nome curado ao DisplayName do manifesto', () => {
    expect(
      appxDisplayName({
        packageName: 'Microsoft.Windows.Photos',
        displayName: 'Photos',
      })
    ).toBe('Fotos');
  });
});

describe('appxDisplayName — pacotes com nome GUID', () => {
  it('resolve o FilePicker pelo InstallLocation', () => {
    expect(
      appxDisplayName({
        packageName: '1527c705-839a-4832-9118-54d4Bd6a0c89',
        displayName: 'ms-resource:AppxManifest_DisplayName',
        installLocation: 'C:\\Windows\\SystemApps\\Microsoft.Windows.FilePicker_cw5n1h2txyewy',
      })
    ).toBe('Seletor de Arquivos do Windows');
  });

  it('resolve o Explorador de Arquivos pelo InstallLocation', () => {
    expect(
      appxDisplayName({
        packageName: 'c5e2524a-ea46-4f67-841f-6a9465d9d515',
        displayName: 'ms-resource:AppxManifest_DisplayName',
        installLocation: 'C:\\Windows\\SystemApps\\Microsoft.Windows.FileExplorer_cw5n1h2txyewy',
      })
    ).toBe('Explorador de Arquivos');
  });

  it('humaniza a pasta quando o GUID não está no mapa', () => {
    expect(
      appxDisplayName({
        packageName: '00000000-1111-2222-3333-444444444444',
        displayName: 'ms-resource:AppxManifest_DisplayName',
        installLocation: 'C:\\Windows\\SystemApps\\Contoso.WidgetHost_cw5n1h2txyewy',
      })
    ).toBe('Contoso Widget Host');
  });

  it('não devolve o GUID humanizado quando não há InstallLocation', () => {
    const name = appxDisplayName({
      packageName: '00000000-1111-2222-3333-444444444444',
      displayName: 'ms-resource:AppxManifest_DisplayName',
    });

    expect(name).toBe('Componente do Windows');
  });
});

describe('appxDisplayName — pacotes provisionados', () => {
  it('usa o nome do provisionado quando não há instalado nem curadoria', () => {
    expect(
      appxDisplayName({
        packageName: 'Contoso.ProvisionedApp',
        provisionedDisplayName: 'Contoso App',
      })
    ).toBe('Contoso App');
  });

  it('ignora provisionado vazio ou ms-resource', () => {
    expect(
      appxDisplayName({
        packageName: 'Contoso.ProvisionedApp',
        provisionedDisplayName: 'ms-resource:AppName',
      })
    ).toBe('Contoso Provisioned App');
  });

  it('cai para a humanização do package name no fim', () => {
    expect(appxDisplayName({ packageName: 'Microsoft.XboxGamingOverlay' })).toBe('Xbox Game Bar');
  });
});

describe('appxDisplayName — drivers de placa de vídeo', () => {
  it.each([
    ['AdvancedMicroDevicesInc-RSXCM', 'AMD Radeon Settings'],
    ['AppUp.IntelGraphicsExperience', 'Central de Gráficos Intel'],
    ['NVIDIACorp.NVIDIAControlPanel', 'Painel de Controle NVIDIA'],
  ])('nomeia %s corretamente quando o manifesto não resolve', (packageName, expected) => {
    expect(
      appxDisplayName({
        packageName,
        displayName: 'ms-resource:AppxManifest_DisplayName',
      })
    ).toBe(expected);
  });
});
