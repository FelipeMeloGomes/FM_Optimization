import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

/**
 * Conteúdo perigoso que a auditoria da beta mandou corrigir. O catálogo é a
 * fonte real (base64), então cada teste decodifica o script publicado em vez de
 * confiar numa cópia transcrita à mão.
 */
const SCRIPTS_PATH = resolve(cwd(), 'resources/scripts.json');

interface ScriptEntry {
  id: string;
  name: string;
  description: string;
  guide: string;
  content: string;
}

const scripts: ScriptEntry[] = JSON.parse(readFileSync(SCRIPTS_PATH, 'utf-8'));

function find(id: string): ScriptEntry {
  const script = scripts.find((s) => s.id === id);
  if (!script) throw new Error(`Script ${id} not found`);
  return script;
}

function decode(id: string): string {
  return Buffer.from(find(id).content, 'base64').toString('utf-8');
}

describe('apps-2 — menu de seguranca nao desliga protecoes', () => {
  it('nao oferece desativar Windows Update', () => {
    const content = decode('apps-2');
    expect(content).not.toMatch(/WindowsUpdate/i);
    expect(content).not.toMatch(/NoAutoUpdate/i);
    expect(content).not.toMatch(/wuauserv/i);
  });

  it('nao oferece desativar o Windows Defender', () => {
    const content = decode('apps-2');
    expect(content).not.toMatch(/DisableAntiSpyware/i);
    expect(content).not.toMatch(/DisableBehaviorMonitoring/i);
    expect(content).not.toMatch(/DisableOnAccessProtection/i);
    expect(content).not.toMatch(/DisableScanOnRealtimeEnable/i);
    expect(content).not.toMatch(/Windows Defender/i);
  });

  it('continua bloqueando a instalacao forcada de apps', () => {
    const content = decode('apps-2');
    expect(content).toContain(
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v SilentInstalledAppsEnabled /t REG_DWORD /d 0 /f'
    );
    expect(content).toContain(
      'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent" /v DisableWindowsConsumerFeatures /t REG_DWORD /d 1 /f'
    );
  });

  it('reduz o menu para a unica opcao que sobrou', () => {
    const content = decode('apps-2');
    expect(content).toContain('choice /c 12 /n');
    expect(content).toContain('if errorlevel 2 exit /b');
    expect(content).toContain('if errorlevel 1 goto blockapps');
    expect(content).not.toMatch(/errorlevel [34]/i);
  });

  it('nao promete mais desligar seguranca na descricao', () => {
    const script = find('apps-2');
    expect(`${script.description} ${script.guide}`).not.toMatch(/Windows Update|Defender/i);
    expect(script.description).toMatch(/instala[cç][aã]o for[cç]ada/i);
  });
});

describe('inputlag-4 — pacote de input lag sem alteracoes alheias', () => {
  it('nao desliga mais o UAC', () => {
    expect(decode('inputlag-4')).not.toMatch(/EnableLUA/i);
  });

  it('nao mexe mais no Windows Update', () => {
    const content = decode('inputlag-4');
    expect(content).not.toMatch(/WindowsUpdate/i);
    expect(content).not.toMatch(/NoAutoUpdate/i);
  });

  it('mantem todos os ajustes de input lag que dao nome ao script', () => {
    const content = decode('inputlag-4');
    for (const key of [
      'LargeSystemCache',
      'TCPNoDelay',
      'DisableSelectiveSuspend',
      'Win32PrioritySeparation',
      'KeyboardDelay',
      'MenuShowDelay',
      'MouseSpeed',
    ]) {
      expect(content, key).toContain(key);
    }
  });

  it('nao anuncia Windows Update na descricao', () => {
    expect(find('inputlag-4').description).not.toMatch(/Windows Update/i);
  });
});

describe('internet-11 — reverter Internet usa a chave certa do AFD', () => {
  it('nao referencia o servico ADF (typo)', () => {
    expect(decode('internet-11')).not.toMatch(/Services\\ADF\\/);
  });

  it('remove as 12 entradas que apontavam para o servico ADF', () => {
    // O script ja tinha 22 entradas corretas de AFD; as 12 do typo viram AFD.
    const matches = decode('internet-11').match(/Services\\AFD\\Parameters/g) ?? [];
    expect(matches).toHaveLength(34);
  });

  it('nenhum script do catalogo tem o typo ADF', () => {
    const offenders = scripts.filter((s) =>
      /Services\\ADF\\/.test(Buffer.from(s.content, 'base64').toString('utf-8'))
    );
    expect(offenders.map((s) => s.id)).toEqual([]);
  });
});

describe('internet-4 — AFD Tweaks grava na chave real do AFD', () => {
  it('nao referencia o servico ADF (typo)', () => {
    expect(decode('internet-4')).not.toMatch(/Services\\ADF\\/);
  });

  it('grava as entradas do typo na chave real do AFD', () => {
    expect(decode('internet-4')).toContain(
      'Reg.exe add "HKLM\\System\\CurrentControlSet\\Services\\AFD\\Parameters" /v "DisablePagingExecutive"'
    );
  });
});

describe('limpezas nao apagam .log do disco inteiro', () => {
  const cleaners = ['cleaner-1', 'cleaner-4'];

  it.each(cleaners)('%s nao usa del em C:\\*.log', (id) => {
    const content = decode(id);
    expect(content).not.toContain('del /s /q C:\\*.log');
    expect(content).not.toMatch(/del\b[^\r\n]*C:\\\*\.log/i);
  });

  it.each(cleaners)('%s limita os .log as pastas temporarias', (id) => {
    const content = decode(id);
    expect(content).toContain('del /f /s /q "%temp%\\*.log" >nul 2>&1');
    expect(content).toContain('del /f /s /q "C:\\Windows\\Temp\\*.log" >nul 2>&1');
  });
});
