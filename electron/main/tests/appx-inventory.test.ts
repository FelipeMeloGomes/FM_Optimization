import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAppxInventoryCache,
  getAppxInventory,
  type PowerShellRunner,
  removeAppxPackages,
} from '../services/appx-inventory';

/**
 * O inventário tem duas responsabilidades que precisam de teste próprio: ler a
 * saída real do PowerShell (que muda de forma entre array/objeto e entre
 * instalado/provisionado) e nunca deixar remover um app protegido, mesmo que o
 * renderer peça. O runner é injetado para não tocar no Windows de verdade.
 */

const STORE_FAMILY = 'Microsoft.WindowsStore_8wekyb3d8bbwe';
const XBOX_FAMILY = 'Microsoft.XboxGamingOverlay_8wekyb3d8bbwe';
const FRAMEWORK_FAMILY = 'Microsoft.UI.Xaml.2.8_8wekyb3d8bbwe';

function installed(overrides: Record<string, unknown> = {}) {
  return {
    Name: 'Microsoft.XboxGamingOverlay',
    PackageFullName: 'Microsoft.XboxGamingOverlay_1.0.0.0_x64__8wekyb3d8bbwe',
    PackageFamilyName: XBOX_FAMILY,
    Version: '1.0.0.0',
    Publisher: 'CN=Microsoft Corporation',
    IsFramework: false,
    NonRemovable: false,
    SignatureKind: 'Store',
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    installed: [installed()],
    provisioned: [
      {
        DisplayName: 'Microsoft.XboxGamingOverlay',
        PackageName: 'Microsoft.XboxGamingOverlay_1.0.0.0_neutral_~_8wekyb3d8bbwe',
        Version: '1.0.0.0',
      },
    ],
    ...overrides,
  });
}

function runnerReturning(output: string): PowerShellRunner {
  return vi.fn(async () => output);
}

function removalOutput(
  results: Array<{ familyName: string; success: boolean; error?: string }>
): string {
  return JSON.stringify(results);
}

beforeEach(() => {
  clearAppxInventoryCache();
});

describe('getAppxInventory — leitura', () => {
  it('lê instalados e provisionados e deduplica por PackageFamilyName', async () => {
    const run = runnerReturning(payload());

    const inventory = await getAppxInventory({
      elevated: true,
      runPowerShell: run,
      now: () => 1000,
    });

    expect(inventory.packages).toHaveLength(1);
    const app = inventory.packages[0];
    expect(app.familyName).toBe(XBOX_FAMILY);
    expect(app.packageName).toBe('Microsoft.XboxGamingOverlay');
    expect(app.displayName).toBe('Xbox Game Bar');
    expect(app.isProvisioned).toBe(true);
    expect(app.removable).toBe(true);
    expect(app.recommended).toBe(true);
    expect(inventory).toMatchObject({ elevated: true, scannedAt: 1000 });
  });

  it('usa -AllUsers apenas quando o processo está elevado', async () => {
    const elevatedRunner = runnerReturning(payload());
    const userRunner = runnerReturning(payload());

    await getAppxInventory({ elevated: true, runPowerShell: elevatedRunner });
    clearAppxInventoryCache();
    await getAppxInventory({ elevated: false, runPowerShell: userRunner });

    const elevatedScript = (elevatedRunner as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const userScript = (userRunner as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(elevatedScript).toContain('Get-AppxPackage -AllUsers');
    expect(userScript).not.toContain('Get-AppxPackage -AllUsers');
    expect(userScript).toContain('Get-AppxPackage');
  });

  it('usa o DisplayName do manifesto para apps fora do mapa curado', async () => {
    const output = JSON.stringify({
      installed: [
        installed({
          Name: '5319275A.WhatsAppDesktop',
          PackageFamilyName: '5319275A.WhatsAppDesktop_cv1g1gvanyjgm',
          DisplayName: 'WhatsApp',
          InstallLocation:
            'C:\\Program Files\\WindowsApps\\5319275A.WhatsAppDesktop_2.2504.3.0_x64__cv1g1gvanyjgm',
        }),
      ],
      provisioned: [],
    });

    const inventory = await getAppxInventory({
      elevated: true,
      runPowerShell: runnerReturning(output),
    });

    expect(inventory.packages[0]).toMatchObject({
      packageName: '5319275A.WhatsAppDesktop',
      displayName: 'WhatsApp',
    });
  });

  it('resolve pacote com nome GUID pelo InstallLocation', async () => {
    const output = JSON.stringify({
      installed: [
        installed({
          Name: '1527c705-839a-4832-9118-54d4Bd6a0c89',
          PackageFamilyName: '1527c705-839a-4832-9118-54d4Bd6a0c89_cw5n1h2txyewy',
          DisplayName: 'ms-resource:AppxManifest_DisplayName',
          InstallLocation: 'C:\\Windows\\SystemApps\\Microsoft.Windows.FilePicker_cw5n1h2txyewy',
          NonRemovable: true,
        }),
      ],
      provisioned: [],
    });

    const inventory = await getAppxInventory({
      elevated: true,
      runPowerShell: runnerReturning(output),
    });

    expect(inventory.packages[0].displayName).toBe('Seletor de Arquivos do Windows');
    expect(inventory.packages[0].removable).toBe(false);
  });

  it('não confunde o DisplayName do provisionado com o package name', async () => {
    const output = JSON.stringify({
      installed: [],
      provisioned: [
        {
          DisplayName: 'Contoso App',
          PackageName: 'Contoso.App_1.0.0.0_neutral_~_8wekyb3d8bbwe',
        },
      ],
    });

    const inventory = await getAppxInventory({
      elevated: true,
      runPowerShell: runnerReturning(output),
    });

    expect(inventory.packages[0]).toMatchObject({
      packageName: 'Contoso.App',
      displayName: 'Contoso App',
      isProvisioned: true,
    });
  });

  it('não consulta provisionados sem administrador', async () => {
    const run = runnerReturning(payload());

    await getAppxInventory({ elevated: false, runPowerShell: run });

    const script = (run as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(script).not.toContain('Get-AppxProvisionedPackage');
  });

  it('inclui o DisplayName e o InstallLocation na varredura', async () => {
    const run = runnerReturning(payload());

    await getAppxInventory({ elevated: true, runPowerShell: run });

    const script = (run as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(script).toContain('Get-AppxPackageManifest');
    expect(script).toContain('DisplayName');
    expect(script).toContain('InstallLocation');
  });

  it('aceita um único objeto em vez de arrays (saída do ConvertTo-Json)', async () => {
    const single = JSON.stringify({
      installed: installed(),
      provisioned: {
        DisplayName: 'Microsoft.XboxGamingOverlay',
        PackageName: 'Microsoft.XboxGamingOverlay_1.0.0.0_neutral_~_8wekyb3d8bbwe',
      },
    });

    const inventory = await getAppxInventory({
      elevated: true,
      runPowerShell: runnerReturning(single),
    });

    expect(inventory.packages).toHaveLength(1);
    expect(inventory.packages[0].isProvisioned).toBe(true);
  });

  it('devolve inventário vazio para saída vazia ou null', async () => {
    for (const output of ['', 'null']) {
      clearAppxInventoryCache();
      const inventory = await getAppxInventory({
        elevated: false,
        runPowerShell: runnerReturning(output),
      });
      expect(inventory.packages).toEqual([]);
    }
  });

  it('rejeita saída que não é JSON em vez de fingir inventário vazio', async () => {
    await expect(
      getAppxInventory({ elevated: true, runPowerShell: runnerReturning('<<<erro>>>') })
    ).rejects.toThrow(/resposta inválida/i);
  });

  it('considera instalado sem provisionado e provisionado sem instalado', async () => {
    const onlyInstalled = JSON.stringify({
      installed: installed({
        Name: 'Microsoft.SkypeApp',
        PackageFamilyName: 'Microsoft.SkypeApp_kzf8qxf38zg5c',
      }),
      provisioned: [],
    });
    const onlyProvisioned = JSON.stringify({
      installed: [],
      provisioned: [
        {
          DisplayName: 'Microsoft.SkypeApp',
          PackageName: 'Microsoft.SkypeApp_1.0_neutral_~_kzf8qxf38zg5c',
        },
      ],
    });

    const a = await getAppxInventory({
      elevated: true,
      runPowerShell: runnerReturning(onlyInstalled),
    });
    clearAppxInventoryCache();
    const b = await getAppxInventory({
      elevated: true,
      runPowerShell: runnerReturning(onlyProvisioned),
    });

    expect(a.packages[0]).toMatchObject({ isProvisioned: false, removable: true });
    expect(b.packages[0]).toMatchObject({
      familyName: 'Microsoft.SkypeApp_kzf8qxf38zg5c',
      isProvisioned: true,
      removable: true,
    });
  });
});

describe('getAppxInventory — proteção e recomendados', () => {
  it('protege Microsoft Store mesmo que o Windows não marque NonRemovable', async () => {
    const output = JSON.stringify({
      installed: [
        installed({
          Name: 'Microsoft.WindowsStore',
          PackageFamilyName: STORE_FAMILY,
          PackageFullName: `Microsoft.WindowsStore_1.0_x64__8wekyb3d8bbwe`,
        }),
      ],
      provisioned: [],
    });

    const inventory = await getAppxInventory({
      elevated: true,
      runPowerShell: runnerReturning(output),
    });

    expect(inventory.packages[0]).toMatchObject({
      removable: false,
      recommended: false,
    });
    expect(inventory.packages[0].protectionReason).toMatch(/Windows/);
  });

  it('protege frameworks e apps marcados como NonRemovable', async () => {
    const output = JSON.stringify({
      installed: [
        installed({
          Name: 'Microsoft.UI.Xaml.2.8',
          PackageFamilyName: FRAMEWORK_FAMILY,
          IsFramework: true,
        }),
        installed({
          Name: 'Fabricante.AppFixo',
          PackageFamilyName: 'Fabricante.AppFixo_123',
          NonRemovable: true,
        }),
      ],
      provisioned: [],
    });

    const inventory = await getAppxInventory({
      elevated: true,
      runPowerShell: runnerReturning(output),
    });

    expect(inventory.packages.every((app) => !app.removable)).toBe(true);
    const reasons = Object.fromEntries(
      inventory.packages.map((app) => [app.packageName, app.protectionReason])
    );
    expect(reasons['Microsoft.UI.Xaml.2.8']).toMatch(/Framework/);
    expect(reasons['Fabricante.AppFixo']).toMatch(/não removível/);
  });

  it('protege drivers de placa de vídeo AMD, Intel e NVIDIA mesmo sem NonRemovable', async () => {
    const output = JSON.stringify({
      installed: [
        installed({
          Name: 'AdvancedMicroDevicesInc-RSXCM',
          PackageFamilyName: 'AdvancedMicroDevicesInc-RSXCM_v2es6h43hjn86',
          Publisher: 'CN=Advanced Micro Devices, O=Advanced Micro Devices, S=California, C=US',
          SignatureKind: 'Developer',
          DisplayName: 'ms-resource:AppxManifest_DisplayName',
        }),
        installed({
          Name: 'AppUp.IntelGraphicsExperience',
          PackageFamilyName: 'AppUp.IntelGraphicsExperience_8j3eq9eme6ctt',
          Publisher: 'CN=Intel Corporation',
          DisplayName: 'Intel Graphics Command Center',
        }),
        installed({
          Name: 'NVIDIACorp.NVIDIAControlPanel',
          PackageFamilyName: 'NVIDIACorp.NVIDIAControlPanel_56jybpbsd1xpy',
          Publisher: 'CN=NVIDIA Corporation',
        }),
        installed({
          Name: 'Fabricante.GPUControl',
          PackageFamilyName: 'Fabricante.GPUControl_123',
          Publisher: 'CN=NVIDIA Corporation',
        }),
        installed({
          Name: 'Contoso.VideoPlayer',
          PackageFamilyName: 'Contoso.VideoPlayer_123',
          Publisher: 'CN=Contoso',
        }),
      ],
      provisioned: [],
    });

    const inventory = await getAppxInventory({
      elevated: true,
      runPowerShell: runnerReturning(output),
    });

    const byName = Object.fromEntries(inventory.packages.map((app) => [app.packageName, app]));
    for (const name of [
      'AdvancedMicroDevicesInc-RSXCM',
      'AppUp.IntelGraphicsExperience',
      'NVIDIACorp.NVIDIAControlPanel',
      'Fabricante.GPUControl',
    ]) {
      expect(byName[name].removable).toBe(false);
      expect(byName[name].protectionReason).toMatch(/vídeo/i);
    }
    expect(byName['AdvancedMicroDevicesInc-RSXCM'].displayName).toBe('AMD Radeon Settings');
    expect(byName['AppUp.IntelGraphicsExperience'].displayName).toBe('Central de Gráficos Intel');
    expect(byName['NVIDIACorp.NVIDIAControlPanel'].displayName).toBe('Painel de Controle NVIDIA');
    expect(byName['Contoso.VideoPlayer'].removable).toBe(true);
  });

  it('não recomenda app desconhecido, só a lista curada', async () => {
    const output = JSON.stringify({
      installed: [
        installed({
          Name: 'Contoso.App',
          PackageFamilyName: 'Contoso.App_123',
          Publisher: 'CN=Contoso',
        }),
      ],
      provisioned: [],
    });

    const inventory = await getAppxInventory({
      elevated: true,
      runPowerShell: runnerReturning(output),
    });

    expect(inventory.packages[0]).toMatchObject({ removable: true, recommended: false });
  });
});

describe('getAppxInventory — cache', () => {
  it('reaproveita a varredura dentro do TTL e revarre no refresh', async () => {
    const now = 1000;
    const run = runnerReturning(payload());

    await getAppxInventory({ elevated: true, runPowerShell: run, now: () => now });
    await getAppxInventory({ elevated: true, runPowerShell: run, now: () => now });
    expect(run).toHaveBeenCalledTimes(1);

    await getAppxInventory({ elevated: true, runPowerShell: run, refresh: true, now: () => now });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('expira o cache depois de 60 segundos', async () => {
    let now = 1000;
    const run = runnerReturning(payload());

    await getAppxInventory({ elevated: true, runPowerShell: run, now: () => now });
    now += 61_000;
    await getAppxInventory({ elevated: true, runPowerShell: run, now: () => now });

    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe('removeAppxPackages', () => {
  const inventoryWith = (items: ReturnType<typeof installed>[]) =>
    runnerReturning(JSON.stringify({ installed: items, provisioned: [] }));

  it('exige administrador antes de rodar qualquer remoção', async () => {
    const run = vi.fn(async () => removalOutput([]));

    await expect(
      removeAppxPackages([XBOX_FAMILY], { elevated: false, runPowerShell: run })
    ).rejects.toThrow(/administrador/i);
    expect(run).not.toHaveBeenCalled();
  });

  it('recusa família desconhecida sem montar a remoção', async () => {
    const run = vi.fn(async () => JSON.stringify({ installed: [], provisioned: [] }));

    await expect(
      removeAppxPackages(['Contoso.Unknown_123'], { elevated: true, runPowerShell: run })
    ).rejects.toThrow(/desconhecid/i);
    // Só a varredura do inventário roda; nada de script de remoção.
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('recusa app protegido mesmo que esteja no inventário', async () => {
    const run = vi.fn(async (script: string) => {
      if (script.includes('$installed =')) {
        return JSON.stringify({
          installed: [
            installed({
              Name: 'Microsoft.WindowsStore',
              PackageFamilyName: STORE_FAMILY,
            }),
          ],
          provisioned: [],
        });
      }
      return removalOutput([]);
    });

    await expect(
      removeAppxPackages([STORE_FAMILY], { elevated: true, runPowerShell: run })
    ).rejects.toThrow(/protegid/i);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('remove instalado e provisionado e relata sucesso', async () => {
    const run = vi.fn(async (script: string) => {
      if (script.includes('$installed =')) {
        return JSON.stringify({ installed: [installed()], provisioned: [] });
      }
      return removalOutput([{ familyName: XBOX_FAMILY, success: true }]);
    });

    const result = await removeAppxPackages([XBOX_FAMILY], {
      elevated: true,
      runPowerShell: run,
    });

    expect(result).toEqual({ removed: [XBOX_FAMILY], failed: [] });
    const removalScript = run.mock.calls[1][0] as string;
    expect(removalScript).toContain('Remove-AppxPackage -AllUsers');
    expect(removalScript).toContain('Remove-AppxProvisionedPackage -Online');
    expect(removalScript).toContain(XBOX_FAMILY);
    // Get-AppxPackage não tem -PackageFamilyName: o filtro é por objeto.
    expect(removalScript).toContain('Where-Object { $_.PackageFamilyName -eq $family }');
    expect(removalScript).not.toContain('Contoso');
  });

  it('continua nos apps que falham e devolve o erro de cada um', async () => {
    const secondFamily = 'Microsoft.SkypeApp_kzf8qxf38zg5c';
    const run = vi.fn(async (script: string) => {
      if (script.includes('$installed =')) {
        return JSON.stringify({
          installed: [
            installed(),
            installed({
              Name: 'Microsoft.SkypeApp',
              PackageFamilyName: secondFamily,
              PackageFullName: 'Microsoft.SkypeApp_1.0_x64__kzf8qxf38zg5c',
            }),
          ],
          provisioned: [],
        });
      }
      return removalOutput([
        { familyName: XBOX_FAMILY, success: true },
        { familyName: secondFamily, success: false, error: 'pacote em uso' },
      ]);
    });

    const result = await removeAppxPackages([XBOX_FAMILY, secondFamily], {
      elevated: true,
      runPowerShell: run,
    });

    expect(result.removed).toEqual([XBOX_FAMILY]);
    expect(result.failed).toEqual([{ familyName: secondFamily, error: 'pacote em uso' }]);
  });

  it('invalida o cache depois de remover: a próxima leitura revarre', async () => {
    const run = vi.fn(async (script: string) => {
      if (script.includes('Remove-AppxPackage')) {
        return removalOutput([{ familyName: XBOX_FAMILY, success: true }]);
      }
      return JSON.stringify({ installed: [installed()], provisioned: [] });
    });

    await getAppxInventory({ elevated: true, runPowerShell: run });
    await removeAppxPackages([XBOX_FAMILY], { elevated: true, runPowerShell: run });
    await getAppxInventory({ elevated: true, runPowerShell: run });

    // 1ª leitura + 1 remoção (que resolve o inventário do cache) + 1 releitura
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('rejeita nome de família com caractere de injeção', async () => {
    const run = vi.fn(async () => removalOutput([]));

    await expect(
      removeAppxPackages(["Microsoft.SkypeApp'; Remove-Item C:\\"], {
        elevated: true,
        runPowerShell: run,
      })
    ).rejects.toThrow(/família inválida/i);
    expect(run).not.toHaveBeenCalled();
  });
});
