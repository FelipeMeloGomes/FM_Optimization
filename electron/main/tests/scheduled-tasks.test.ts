import { describe, expect, it } from 'vitest';
import {
  buildScheduledTaskToggleScript,
  parseScheduledTaskId,
  parseScheduledTasks,
  scheduledTaskId,
} from '../services/scheduled-tasks';

const RAW = [
  {
    name: 'OneDrive Standalone Update Task',
    path: '\\',
    state: 'Ready',
    trigger: 'logon',
    action: 'C:\\Users\\me\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe',
    author: 'Microsoft Corporation',
  },
  {
    name: 'Adobe Acrobat Update Task',
    path: '\\Adobe Acrobat Update Task',
    state: 'Disabled',
    trigger: 'boot',
    action: 'C:\\Program Files\\Adobe\\Acrobat\\Acrobat.exe',
    author: 'Adobe',
  },
  {
    name: 'Every day',
    path: '\\Custom',
    state: 'Ready',
    trigger: 'daily',
    action: 'C:\\Tools\\tool.exe',
    author: 'Me',
  },
];

describe('parseScheduledTasks', () => {
  it('keeps only logon and boot triggers', () => {
    const tasks = parseScheduledTasks(JSON.stringify(RAW));

    expect(tasks.map((t) => t.name)).toEqual([
      'OneDrive Standalone Update Task',
      'Adobe Acrobat Update Task',
    ]);
  });

  it('maps state and trigger', () => {
    const [oneDrive, adobe] = parseScheduledTasks(JSON.stringify(RAW));

    expect(oneDrive).toMatchObject({ trigger: 'logon', enabled: true, requiresAdmin: true });
    expect(adobe).toMatchObject({ trigger: 'boot', enabled: false, requiresAdmin: true });
  });

  it('flags Microsoft tasks by path or author', () => {
    const tasks = parseScheduledTasks(
      JSON.stringify([
        {
          name: 'A',
          path: '\\Microsoft\\Windows\\Foo\\',
          state: 'Ready',
          trigger: 'logon',
          action: 'x',
          author: '',
        },
        {
          name: 'B',
          path: '\\Vendor\\',
          state: 'Ready',
          trigger: 'logon',
          action: 'x',
          author: 'Microsoft Corporation',
        },
        {
          name: 'C',
          path: '\\Vendor\\',
          state: 'Ready',
          trigger: 'logon',
          action: 'x',
          author: 'Adobe',
        },
      ])
    );

    expect(tasks.map((t) => t.isMicrosoft)).toEqual([true, true, false]);
  });

  it('accepts a single object and rejects malformed input', () => {
    expect(parseScheduledTasks(JSON.stringify(RAW[0]))).toHaveLength(1);
    expect(parseScheduledTasks('nope')).toEqual([]);
  });
});

describe('scheduledTaskId', () => {
  it('round-trips a task path and name', () => {
    const id = scheduledTaskId('\\Microsoft\\Windows\\Foo\\', 'Bar');
    expect(id).toBe('task:\\Microsoft\\Windows\\Foo\\Bar');
    expect(parseScheduledTaskId(id)).toEqual({ path: '\\Microsoft\\Windows\\Foo\\', name: 'Bar' });
  });

  it('round-trips a root task', () => {
    const id = scheduledTaskId('\\', 'OneDrive');
    expect(parseScheduledTaskId(id)).toEqual({ path: '\\', name: 'OneDrive' });
  });

  it('rejects ids from another kind', () => {
    expect(parseScheduledTaskId('app:registry-user:Steam')).toBeNull();
  });
});

describe('buildScheduledTaskToggleScript', () => {
  const task = parseScheduledTasks(JSON.stringify(RAW))[1];

  it('disables with Disable-ScheduledTask', () => {
    const script = buildScheduledTaskToggleScript(task, false);

    expect(script).toContain('Disable-ScheduledTask');
    expect(script).toContain("-TaskPath '\\Adobe Acrobat Update Task'");
    expect(script).toContain("-TaskName 'Adobe Acrobat Update Task'");
  });

  it('enables with Enable-ScheduledTask', () => {
    const script = buildScheduledTaskToggleScript(task, true);

    expect(script).toContain('Enable-ScheduledTask');
  });

  it('escapes single quotes', () => {
    const script = buildScheduledTaskToggleScript({ ...task, name: "Bob's task" }, false);

    expect(script).toContain("-TaskName 'Bob''s task'");
  });
});
