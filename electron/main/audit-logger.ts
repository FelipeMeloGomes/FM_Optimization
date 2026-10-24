import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { app } from 'electron';

type AuditLevel = 'info' | 'warn' | 'error' | 'security';

interface AuditEntry {
  timestamp: string;
  level: AuditLevel;
  event: string;
  details: Record<string, unknown>;
  pid: number;
}

const LOG_DIR = resolve(app.getPath('userData'), 'logs');
const LOG_FILE = resolve(LOG_DIR, 'audit.log');

if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

function writeEntry(entry: AuditEntry): void {
  appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf-8');
}

export function auditLog(
  level: AuditLevel,
  event: string,
  details: Record<string, unknown> = {}
): void {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    details,
    pid: process.pid,
  };
  writeEntry(entry);
}

export function auditAdminCheck(result: boolean, context: string): void {
  auditLog('info', 'admin_check', { result, context });
}

export function auditScriptExecution(
  scriptId: string,
  scriptName: string,
  requiresAdmin: boolean,
  adminCheck: boolean,
  exitCode: number | null,
  success: boolean
): void {
  auditLog(success ? 'info' : 'error', 'script_execution', {
    scriptId,
    scriptName,
    requiresAdmin,
    adminCheck,
    exitCode,
    success,
  });
}

export function auditIpcValidation(channel: string, success: boolean, error?: string): void {
  auditLog(success ? 'info' : 'warn', 'ipc_validation', { channel, success, error });
}

export function auditDenyListCheck(scriptId: string, allowed: boolean, violations: string[]): void {
  if (!allowed) {
    auditLog('security', 'deny_list_violation', { scriptId, violations });
  }
}
