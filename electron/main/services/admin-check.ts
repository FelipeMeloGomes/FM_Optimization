import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { auditAdminCheck } from '../audit-logger';

const execFileAsync = promisify(execFile);

let adminCache: { result: boolean; expires: number } | null = null;
const CACHE_TTL = 30_000;

async function checkAdminAsync(): Promise<boolean> {
  if (adminCache && Date.now() < adminCache.expires) {
    return adminCache.result;
  }

  try {
    await execFileAsync('net', ['session'], { timeout: 3000 });
    adminCache = { result: true, expires: Date.now() + CACHE_TTL };
    auditAdminCheck(true, 'net session');
    return true;
  } catch {
    try {
      const { stdout } = await execFileAsync('whoami', ['/groups'], {
        timeout: 3000,
        encoding: 'utf-8',
      });
      const result = stdout.includes('S-1-16-12288');
      adminCache = { result, expires: Date.now() + CACHE_TTL };
      auditAdminCheck(result, 'whoami /groups');
      return result;
    } catch {
      adminCache = { result: false, expires: Date.now() + CACHE_TTL };
      auditAdminCheck(false, 'failed');
      return false;
    }
  }
}

export async function isAdminAsync(): Promise<boolean> {
  return checkAdminAsync();
}

export function isAdmin(): boolean {
  if (adminCache && Date.now() < adminCache.expires) {
    return adminCache.result;
  }

  try {
    const { execSync } = require('node:child_process');
    execSync('net session', { timeout: 3000 });
    adminCache = { result: true, expires: Date.now() + CACHE_TTL };
    auditAdminCheck(true, 'net session');
    return true;
  } catch {
    try {
      const { execSync } = require('node:child_process');
      const output = execSync('whoami /groups', { timeout: 3000, encoding: 'utf-8' });
      const result = output.includes('S-1-16-12288');
      adminCache = { result, expires: Date.now() + CACHE_TTL };
      auditAdminCheck(result, 'whoami /groups');
      return result;
    } catch {
      adminCache = { result: false, expires: Date.now() + CACHE_TTL };
      auditAdminCheck(false, 'failed');
      return false;
    }
  }
}
