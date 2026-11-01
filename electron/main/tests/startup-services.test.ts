import { describe, expect, it } from 'vitest';
import {
  buildServiceToggleScript,
  buildStopServiceScript,
  isProtectedService,
  parseServiceId,
  parseServices,
  serviceId,
} from '../services/startup-services';

const RAW = [
  {
    name: 'Spooler',
    displayName: 'Print Spooler',
    startMode: 'Auto',
    state: 'Running',
    delayed: false,
  },
  {
    name: 'SysMain',
    displayName: 'SysMain',
    startMode: 'Auto',
    state: 'Running',
    delayed: true,
  },
  {
    name: 'Fax',
    displayName: 'Fax',
    startMode: 'Manual',
    state: 'Stopped',
    delayed: false,
  },
  {
    name: 'MapsBroker',
    displayName: 'Downloaded Maps Manager',
    startMode: 'Disabled',
    state: 'Stopped',
    delayed: false,
  },
];

describe('parseServices', () => {
  it('keeps automatic and disabled services, dropping manual ones', () => {
    const services = parseServices(JSON.stringify(RAW));

    expect(services.map((s) => s.name).sort()).toEqual(['MapsBroker', 'Spooler', 'SysMain']);
  });

  it('maps delayed automatic start', () => {
    const services = parseServices(JSON.stringify(RAW));
    const byName = new Map(services.map((s) => [s.name, s]));

    expect(byName.get('Spooler')?.startMode).toBe('Automatic');
    expect(byName.get('SysMain')?.startMode).toBe('AutomaticDelayed');
    expect(byName.get('MapsBroker')?.startMode).toBe('Disabled');
  });

  it('marks protected services', () => {
    const services = parseServices(
      JSON.stringify([
        {
          name: 'WinDefend',
          displayName: 'Microsoft Defender Antivirus Service',
          startMode: 'Auto',
          state: 'Running',
          delayed: false,
        },
      ])
    );

    expect(services[0].protected).toBe(true);
    expect(isProtectedService('WinDefend')).toBe(true);
    expect(isProtectedService('Spooler')).toBe(false);
  });

  it('accepts a single object and rejects malformed input', () => {
    expect(parseServices(JSON.stringify(RAW[0]))).toHaveLength(1);
    expect(parseServices('nope')).toEqual([]);
  });
});

describe('serviceId', () => {
  it('round-trips a service name', () => {
    const id = serviceId('Spooler');
    expect(parseServiceId(id)).toBe('Spooler');
    expect(parseServiceId('app:registry-user:Steam')).toBeNull();
  });
});

describe('buildServiceToggleScript', () => {
  const services = parseServices(JSON.stringify(RAW));
  const spooler = services.find((s) => s.name === 'Spooler');
  const sysMain = services.find((s) => s.name === 'SysMain');
  if (!spooler || !sysMain) throw new Error('fixture missing');

  it('disables with Set-Service', () => {
    const script = buildServiceToggleScript(spooler, false, null);

    expect(script).toContain("Set-Service -Name 'Spooler' -StartupType Disabled");
  });

  it('enables as Automatic when there is no recorded original', () => {
    const script = buildServiceToggleScript(spooler, true, null);

    expect(script).toContain("Set-Service -Name 'Spooler' -StartupType Automatic");
  });

  it('restores a delayed automatic start', () => {
    const script = buildServiceToggleScript(sysMain, true, 'AutomaticDelayed');

    expect(script).toContain('sc.exe config "SysMain" start= delayed-auto');
  });

  it('escapes single quotes in service names', () => {
    const script = buildServiceToggleScript({ ...spooler, name: "Bob's service" }, false, null);

    expect(script).toContain("-Name 'Bob''s service'");
  });
});

describe('buildStopServiceScript', () => {
  it('stops the service', () => {
    expect(buildStopServiceScript('Spooler')).toContain("Stop-Service -Name 'Spooler' -Force");
  });
});
