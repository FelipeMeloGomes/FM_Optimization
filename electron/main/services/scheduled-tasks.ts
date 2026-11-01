import type { ScheduledTaskEntry } from '../../shared/ipc-types';
import { psLiteral } from './ps-literal';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function scheduledTaskId(path: string, name: string): string {
  return `task:${path}${name}`;
}

export function parseScheduledTaskId(id: string): { path: string; name: string } | null {
  if (!id.startsWith('task:')) return null;
  const rest = id.slice(5);
  const separator = rest.lastIndexOf('\\');
  if (separator < 0) return null;
  const path = rest.slice(0, separator + 1);
  const name = rest.slice(separator + 1);
  if (!name) return null;
  return { path, name };
}

export function parseScheduledTasks(json: string): ScheduledTaskEntry[] {
  const entries: ScheduledTaskEntry[] = [];

  for (const item of asList(safeParse(json))) {
    if (!isRecord(item)) continue;

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const path = typeof item.path === 'string' && item.path ? item.path : '\\';
    const trigger = item.trigger === 'boot' ? 'boot' : item.trigger === 'logon' ? 'logon' : null;
    if (!name || !trigger) continue;

    const author = typeof item.author === 'string' ? item.author : '';
    const state = typeof item.state === 'string' ? item.state : '';

    entries.push({
      id: scheduledTaskId(path, name),
      name,
      path,
      trigger,
      action: typeof item.action === 'string' ? item.action : '',
      enabled: state.toLowerCase() !== 'disabled',
      requiresAdmin: true,
      isMicrosoft: /^\\Microsoft\\/i.test(path) || /microsoft/i.test(author),
    });
  }

  return entries;
}

export function buildScheduledTaskToggleScript(task: ScheduledTaskEntry, enabled: boolean): string {
  const command = enabled ? 'Enable-ScheduledTask' : 'Disable-ScheduledTask';
  return `${command} -TaskPath ${psLiteral(task.path)} -TaskName ${psLiteral(task.name)} -ErrorAction Stop`;
}
