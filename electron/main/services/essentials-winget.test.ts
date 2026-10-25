import { describe, expect, it } from 'vitest';
import {
  detectWingetPhase,
  isWingetAlreadyInstalled,
  isWingetSuccess,
  lastMeaningfulLine,
  parseWingetPercent,
  parseWingetProgress,
  stripAnsi,
  wingetErrorMessage,
} from './essentials-winget';

const ESC = '\u001b';
const PROGRESS_LINE = '  ██████████████  10.5 MB / 45.8 MB';

describe('stripAnsi', () => {
  it('remove codigos de cor e controle', () => {
    expect(stripAnsi(`${ESC}[32mBaixando${ESC}[0m ${ESC}[?25l`)).toBe('Baixando ');
  });
});

describe('parseWingetProgress', () => {
  it('le a barra de progresso do winget', () => {
    expect(parseWingetProgress(PROGRESS_LINE)).toEqual({
      receivedBytes: 10.5 * 1024 ** 2,
      totalBytes: 45.8 * 1024 ** 2,
      percent: 23,
    });
  });

  it('usa a ultima ocorrencia, ja que o winget reescreve a linha com \\r', () => {
    const output = ['  1.0 MB / 45.8 MB', `${ESC}[32m  45.8 MB / 45.8 MB${ESC}[0m`].join('\r');
    expect(parseWingetPercent(output)).toBe(100);
  });

  it('aceita virgula decimal e unidades diferentes', () => {
    expect(parseWingetPercent('4,5 MB / 9 MB')).toBe(50);
    expect(parseWingetPercent('2048 KB / 1 MB')).toBe(100);
  });

  it('devolve null quando ainda nao ha barra de progresso', () => {
    expect(parseWingetProgress('Found MSI Afterburner [Guru3D.Afterburner]')).toBeNull();
    expect(parseWingetPercent('')).toBeNull();
  });

  it('nao divide por zero', () => {
    expect(parseWingetProgress('0 B / 0 B')).toBeNull();
  });
});

describe('detectWingetPhase', () => {
  it('reconhece download e instalacao em ingles e portugues', () => {
    expect(detectWingetPhase('Downloading https://exemplo/pacote.zip')).toBe('downloading');
    expect(detectWingetPhase('Baixando https://exemplo/pacote.zip')).toBe('downloading');
    expect(detectWingetPhase('Starting package install...')).toBe('installing');
    expect(detectWingetPhase('Instalando ...')).toBe('installing');
  });

  it('vale a fase mais recente do buffer', () => {
    const output = ['Downloading https://exemplo/pacote.zip', 'Starting package install...'].join(
      '\r'
    );
    expect(detectWingetPhase(output)).toBe('installing');
  });

  it('devolve null sem pista de fase', () => {
    expect(detectWingetPhase('Found MSI Afterburner [Guru3D.Afterburner]')).toBeNull();
  });
});

describe('isWingetAlreadyInstalled', () => {
  it('reconhece o aviso do winget nos dois idiomas', () => {
    expect(
      isWingetAlreadyInstalled('Found an existing package already installed. Trying to upgrade...')
    ).toBe(true);
    expect(isWingetAlreadyInstalled('Já está instalado. Tentando atualizar...')).toBe(true);
    expect(isWingetAlreadyInstalled('No applicable update found')).toBe(true);
  });

  it('nao confunde uma falha comum com pacote instalado', () => {
    expect(isWingetAlreadyInstalled('Installer failed with exit code: 1')).toBe(false);
  });
});

describe('isWingetSuccess', () => {
  it('reconhece o fim da instalacao nos dois idiomas', () => {
    expect(isWingetSuccess('Successfully installed')).toBe(true);
    expect(isWingetSuccess('Instalação concluída')).toBe(true);
  });

  it('nao considera sucesso so por ter encontrado o pacote', () => {
    expect(isWingetSuccess('Found MSI Afterburner [Guru3D.Afterburner]')).toBe(false);
  });
});

describe('lastMeaningfulLine', () => {
  it('ignora barras de progresso e linhas vazias', () => {
    const output = ['Installing ...', `${PROGRESS_LINE}\r${PROGRESS_LINE}`, '', '   '].join('\n');
    expect(lastMeaningfulLine(output)).toBe('Installing ...');
  });

  it('trunca linhas muito longas', () => {
    const long = `falhou ao instalar ${'x'.repeat(300)}`;
    const line = lastMeaningfulLine(long, 40);
    expect(line).toHaveLength(40);
    expect(line?.endsWith('…')).toBe(true);
  });

  it('devolve null quando nao ha texto util', () => {
    expect(lastMeaningfulLine('████ 10 MB / 45 MB')).toBeNull();
  });
});

describe('wingetErrorMessage', () => {
  it('avisa quando o winget nem iniciou', () => {
    expect(wingetErrorMessage(null, '')).toContain('App Installer');
  });

  it('explica falha de hash', () => {
    expect(wingetErrorMessage(1, 'Installer hash does not match')).toContain(
      'verificação de integridade'
    );
  });

  it('explica pacote inexistente', () => {
    expect(wingetErrorMessage(1, 'No package found matching input criteria.')).toContain(
      'não encontrou um instalador'
    );
  });

  it('explica elevacao recusada pelo instalador', () => {
    expect(
      wingetErrorMessage(1, 'The installer prohibits running elevated (0x8a15002b)')
    ).toContain('sem privilégios de administrador');
  });

  it('inclui o codigo e a ultima linha util como detalhe', () => {
    const message = wingetErrorMessage(
      -1978335215,
      'Falha ao instalar\r████ 10 MB / 45 MB\rInstaller failed with exit code: 1603'
    );
    expect(message).toContain('0x8a150011');
    expect(message).toContain('Installer failed with exit code: 1603');
  });

  it('nao quebra quando nao ha detalhe', () => {
    expect(wingetErrorMessage(1, '')).toMatch(/falhou ao instalar \(0x1\)\.$/);
  });
});
