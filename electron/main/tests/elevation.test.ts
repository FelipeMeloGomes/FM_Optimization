import { describe, expect, it } from 'vitest';
import {
  buildElevationCommand,
  mapElevationExit,
  quoteWindowsArg,
  UAC_CANCELLED_CODE,
} from '../services/elevation';

describe('quoteWindowsArg', () => {
  it('deixa intacto o argumento simples', () => {
    expect(quoteWindowsArg('--hidden')).toBe('--hidden');
    expect(quoteWindowsArg('--wait-pid=1234')).toBe('--wait-pid=1234');
  });

  it('cerca com aspas quando há espaço', () => {
    expect(quoteWindowsArg('C:\\Pasta de Jogos\\app.exe')).toBe('"C:\\Pasta de Jogos\\app.exe"');
  });

  it('escapa as aspas do JSON, senão o processo recebe o valor sem elas', () => {
    expect(quoteWindowsArg('{"interfaceIndex":12}')).toBe('"{\\"interfaceIndex\\":12}"');
  });

  it('dobra as barras que precedem uma aspa', () => {
    expect(quoteWindowsArg('C:\\a"b\\')).toBe('"C:\\a\\"b\\\\"');
  });
});

describe('buildElevationCommand', () => {
  it('escapa aspas simples no caminho', () => {
    const command = buildElevationCommand("C:\\Pasta d'Água\\app.exe", []);
    expect(command).toContain("'C:\\Pasta d''Água\\app.exe'");
  });

  it('passa um ArgumentList único (array perderia as aspas do JSON)', () => {
    const command = buildElevationCommand('C:\\app.exe', [
      '--elevate-dns',
      '{"interfaceIndex":12}',
    ]);
    expect(command).not.toContain('@(');
    expect(command).toContain('--elevate-dns ');
    expect(command).toContain('"{\\"interfaceIndex\\":12}"');
  });

  it('mantém unido o caminho com espaço', () => {
    const command = buildElevationCommand('C:\\app.exe', ['C:\\Meus Jogos\\script.ps1']);
    expect(command).toContain('"C:\\Meus Jogos\\script.ps1"');
  });

  it('não usa -Wait (o filho espera esta instância sair, criaria deadlock)', () => {
    const command = buildElevationCommand('C:\\app.exe', []);
    expect(command).not.toContain('-Wait');
    expect(command).toContain('-Verb RunAs');
  });

  it('traduz o cancelamento do UAC para o código nativo', () => {
    const command = buildElevationCommand('C:\\app.exe', []);
    expect(command).toContain(`exit ${UAC_CANCELLED_CODE}`);
  });
});

describe('mapElevationExit', () => {
  it('0 significa processo elevado iniciado', () => {
    expect(mapElevationExit(0, '')).toEqual({ launched: true, cancelled: false });
  });

  it('1223 significa UAC cancelado pelo usuário, não erro', () => {
    expect(mapElevationExit(UAC_CANCELLED_CODE, '')).toEqual({
      launched: false,
      cancelled: true,
    });
  });

  it('outros códigos viram erro com a mensagem do stderr', () => {
    expect(mapElevationExit(1, ' falhou ')).toEqual({
      launched: false,
      cancelled: false,
      error: 'falhou',
    });
  });

  it('sem stderr, informa o código desconhecido', () => {
    const result = mapElevationExit(null, '   ');
    expect(result.cancelled).toBe(false);
    expect(result.launched).toBe(false);
    expect(result.error).toContain('desconhecido');
  });
});
