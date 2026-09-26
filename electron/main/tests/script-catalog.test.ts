import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import { checkScriptContent } from '../deny-list';

const SCRIPTS_PATH = resolve(cwd(), 'resources/scripts.json');

interface ScriptEntry {
  id: string;
  name: string;
  description: string;
  guide: string;
  category: string;
  subcategory: string;
  extension: string;
  tags: string[];
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

const cpu = scripts.filter((s) => s.category === 'CPU');

describe('merged processor catalog', () => {
  it('has 104 entries with 37 processor scripts', () => {
    expect(scripts).toHaveLength(104);
    expect(cpu).toHaveLength(37);
  });

  it('retires every amd-* and intel-* id', () => {
    expect(scripts.filter((s) => /^(amd|intel)-\d+$/.test(s.id)).map((s) => s.id)).toEqual([]);
  });

  it('numbers the processor scripts cpu-1 through cpu-37 with no gaps', () => {
    expect(cpu.map((s) => s.id)).toEqual(Array.from({ length: 37 }, (_, i) => `cpu-${i + 1}`));
  });

  it('carries no vendor name in its text fields', () => {
    // The split existed only to file scripts under two folders; every pair was
    // byte-identical or differed by banner/credit lines, so the vendor never
    // belonged in the copy.
    for (const script of cpu) {
      const text = `${script.name} ${script.description} ${script.guide}`;
      expect(text, script.id).not.toMatch(/\b(AMD|Intel|Ryzen|Threadripper|EPYC)\b/i);
    }
  });

  it('carries no vendor tag', () => {
    expect(
      cpu.filter((s) => s.tags.some((t) => t === 'amd' || t === 'intel')).map((s) => s.id)
    ).toEqual([]);
  });

  it('merges the two vendor tag sets rather than dropping one', () => {
    // cpu-1's AMD copy carried `hpet` and the Intel copy carried `otimizacao`.
    // Both describe the same merged script, so the union is what survives.
    expect(find('cpu-1').tags.sort()).toEqual(['bcdedit', 'boot', 'hpet', 'otimizacao']);
  });

  it('exposes no remaining byte-identical pair', () => {
    // The only survivor is a pre-existing duplicate unrelated to the vendor
    // split: amd-21 and amd-24 shipped the same .reg under two names. Tracked
    // separately, see the duplicate-reg test below.
    const KNOWN_DUPLICATES: Array<[string, string, string]> = [
      [
        'cpu-21',
        'cpu-24',
        'pre-existing: amd-21 and amd-24 were already byte-identical in the ' +
          'published catalog and were never an AMD/Intel pair. Collapse is a ' +
          'follow-up, not part of the vendor merge.',
      ],
    ];

    const byBytes = new Map<string, string[]>();
    for (const script of cpu) {
      const key = Buffer.from(script.content, 'base64').toString('base64');
      byBytes.set(key, [...(byBytes.get(key) ?? []), script.id]);
    }

    const exemptions = new Map(
      KNOWN_DUPLICATES.map(([a, b, reason]) => [[a, b].sort().join('='), reason])
    );

    const duplicates = [...byBytes.values()].filter((ids) => ids.length > 1);
    expect(duplicates).toHaveLength(KNOWN_DUPLICATES.length);
    for (const ids of duplicates) {
      const key = [...ids].sort().join('=');
      expect(exemptions.has(key), `unexpected duplicate: ${ids.join(' == ')}`).toBe(true);
    }
  });

  it('pins the known duplicate so it stays visible until it is collapsed', () => {
    expect(decode('cpu-21')).toBe(decode('cpu-24'));
    // cpu-24 is labelled as a CPU tweak but the .reg only writes GPU and
    // scheduling priority, which is what makes the duplicate confusing.
    expect(find('cpu-24').description).not.toMatch(/CPU/i);
  });
});

describe('registry files are importable by regedit', () => {
  // regedit parses the first line positionally: it must be exactly the version
  // header, with no BOM and no leading whitespace. Anything before it makes the
  // import fail outright with a key/value error. Two bugs hit this:
  // intel-16/intel-19 (now cpu-21/cpu-24) started with a UTF-8 BOM, and
  // builtin-4/builtin-6 started with a space.
  const HEADER = 'Windows Registry Editor Version 5.00';

  it('has .reg scripts to check', () => {
    expect(scripts.filter((s) => s.extension === 'reg').length).toBeGreaterThan(0);
  });

  it('starts every .reg with the version header, byte for byte', () => {
    const offenders = scripts
      .filter((s) => s.extension === 'reg')
      .filter((s) => !Buffer.from(s.content, 'base64').toString('utf-8').startsWith(HEADER))
      .map((s) => s.id);
    expect(offenders).toEqual([]);
  });

  it('keeps the header on line 1, with no blank or indented line before it', () => {
    // Asserted separately from the startsWith check above so a failure names the
    // actual kind of junk rather than just "false is not true".
    for (const script of scripts.filter((s) => s.extension === 'reg')) {
      const firstLine = Buffer.from(script.content, 'base64').toString('utf-8').split(/\r?\n/)[0];
      expect(firstLine, script.id).toBe(HEADER);
    }
  });
});

describe('merged script content selection', () => {
  // Pairs whose decoded content differed. Each winner is the copy without the
  // defect noted below, so the merge can never reintroduce it.
  const EQUIVALENT_PAIRS = [
    'cpu-2',
    'cpu-9',
    'cpu-11',
    'cpu-16',
    'cpu-18',
    'cpu-19',
    'cpu-21',
    'cpu-23',
    'cpu-24',
    'cpu-28',
  ];

  it.each(EQUIVALENT_PAIRS.filter((id) => find(id).extension === 'reg'))(
    '%s starts with the registry header regedit requires',
    (id) => {
      // A UTF-8 BOM before "Windows Registry Editor Version 5.00" makes regedit
      // reject the file outright. intel-16 and intel-19 shipped that way.
      const content = decode(id);
      expect(content.startsWith('Windows Registry Editor Version 5.00'), id).toBe(true);
    }
  );

  it('ships no BOM in any merged script', () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const offenders = cpu
      .filter((s) => Buffer.from(s.content, 'base64').subarray(0, 3).equals(bom))
      .map((s) => s.id);
    expect(offenders).toEqual([]);
  });

  it('ships no script content with a leading UTF-8 BOM', () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const offenders = scripts
      .filter((s) => Buffer.from(s.content, 'base64').subarray(0, 3).equals(bom))
      .map((s) => s.id);
    expect(offenders).toEqual([]);
  });

  it('cpu-2 keeps the AMD copy, which omits the VBS prompt', () => {
    // The Intel copy appended ten echo lines that ran a VBS msgbox, so running
    // the "clean up" script could interrupt the user with a dialog.
    const content = decode('cpu-2');
    expect(content).not.toMatch(/vbscript|msgbox/i);
  });

  it('cpu-23 is described in terms of the value it actually writes', () => {
    // The AMD copy described responsiveness in general terms; the Intel copy
    // names SystemResponsiveness, which is the key the .reg sets.
    expect(find('cpu-23').description).toContain('SystemResponsiveness');
    expect(decode('cpu-23')).toContain('SystemResponsiveness');
  });

  it('cpu-4 is filed as a cleanup, matching its name and behaviour', () => {
    expect(find('cpu-4').subcategory).toBe('Limpeza');
  });
});

describe('cpu-1 general optimization', () => {
  it('does not disable DEP', () => {
    // `bcdedit /set nx optout` turns off Data Execution Prevention. The legacy
    // OptOut mitigation package it targeted was removed in Windows 8, so on the
    // Windows 10+ baseline it only removes a security control.
    expect(decode('cpu-1')).not.toContain('nx optout');
  });

  it('does not disable the TPM entropy source', () => {
    // Disabling it degrades the OS RNG, which can affect BitLocker key material.
    expect(decode('cpu-1')).not.toContain('tpmbootentropy');
  });

  it('keeps the description free of the removed TPM claim', () => {
    expect(find('cpu-1').description).not.toMatch(/TPM/i);
    expect(find('cpu-1').description).toContain('hyper-v');
  });

  it('still applies the latency tweaks', () => {
    const content = decode('cpu-1');
    expect(content).toContain('bcdedit /deletevalue useplatformclock');
    expect(content).toContain('bcdedit /set bootmenupolicy standard');
    expect(content).toContain('bcdedit /set hypervisorlaunchtype off');
  });
});

describe('GPU-specific tweaks are not gated on the CPU vendor', () => {
  const GPU_TWEAKS = ['builtin-4', 'builtin-5', 'builtin-6', 'builtin-7'];

  it.each(GPU_TWEAKS)('%s carries the gpu-amd tag instead of the amd tag', (id) => {
    const script = find(id);
    expect(script.tags).toEqual(['gpu-amd']);
    expect(script.tags).not.toContain('amd');
  });

  it('leaves no non-AMD script tagged as CPU-vendor amd', () => {
    // The CommandPalette used to hide anything tagged `amd` on an Intel CPU.
    // These four write to the AMD display-adapter registry key, which can exist
    // alongside an Intel CPU, so they must not be hidden.
    const mislabelled = scripts.filter(
      (s) => s.category !== 'CPU' && s.tags.includes('amd') && !s.tags.includes('gpu-amd')
    );
    expect(mislabelled.map((s) => s.id)).toEqual([]);
  });
});

describe('catalog deny-list exposure', () => {
  it('keeps the number of bcdedit scripts at 9', () => {
    // Was 16 across the duplicated vendor sets; the merge collapses the 14 CPU
    // ones to 7.
    const withBcdedit = scripts.filter((s) => decode(s.id).includes('bcdedit'));
    expect(withBcdedit.map((s) => s.id).sort()).toEqual([
      'builtin-13',
      'cpu-1',
      'cpu-15',
      'cpu-3',
      'cpu-4',
      'cpu-5',
      'cpu-8',
      'cpu-9',
      'tweaks-4',
    ]);
  });

  it('CHARACTERISATION: bcdedit content is reported as allowed', () => {
    // deny-list.ts forbids bcdedit, but checkScriptContent returns
    // `allowed: true` unconditionally, so script-registry.ts never throws.
    // Fixing either that line or the enableDenyListBlock default (false in
    // data-service.ts) would block all 9 scripts above at once. This test fails
    // on purpose when the block goes live, so the behaviour is a decision
    // rather than an accident.
    const { allowed, violations } = checkScriptContent('@echo off\r\nbcdedit /set testsigning yes');
    expect(allowed).toBe(true);
    expect(violations).toEqual(['\\bbcdedit\\b']);
  });
});
