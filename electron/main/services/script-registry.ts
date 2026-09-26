import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { app } from 'electron';
import type { ScriptEntry } from '../../shared/ipc-types';
import { auditDenyListCheck } from '../audit-logger';
import { checkScriptContent } from '../deny-list';
import { resolveScriptId } from '../legacy-script-ids';
import { getScriptTempDir, validateScriptPath } from '../path-validation';

let scriptsCache: ScriptEntry[] | null = null;
let scriptsCacheMtimeMs = 0;

function getResourcesPath(): string {
  return app.isPackaged
    ? resolve(process.resourcesPath, 'scripts.json')
    : resolve(__dirname, '../../resources/scripts.json');
}

export function loadScripts(): ScriptEntry[] {
  const filePath = getResourcesPath();

  // In a packaged build scripts.json lives inside the asar and cannot change, so
  // the cache is permanent. In development the file is edited on disk while the
  // process keeps running: the renderer hot-reloads and starts filtering on the
  // new category while the main process keeps serving the old catalog, and the
  // page renders empty. Re-read whenever the mtime actually moved.
  if (app.isPackaged) {
    if (scriptsCache) return scriptsCache;
  } else {
    const mtimeMs = statSync(filePath).mtimeMs;
    if (scriptsCache && mtimeMs === scriptsCacheMtimeMs) return scriptsCache;
    scriptsCacheMtimeMs = mtimeMs;
  }

  const raw = readFileSync(filePath, 'utf-8');
  const entries: ScriptEntry[] = JSON.parse(raw);

  scriptsCache = entries.map((entry, i) => ({
    ...entry,
    id: entry.id || `builtin-${i}`,
  }));

  return scriptsCache;
}

export function getScriptById(id: string): ScriptEntry | undefined {
  const scripts = loadScripts();
  return scripts.find((s) => s.id === resolveScriptId(id));
}

export function getScriptContent(id: string): string {
  const script = getScriptById(id);
  if (!script) throw new Error(`Script not found: ${id}`);

  const content = Buffer.from(script.content, 'base64').toString('utf-8');

  const { allowed, violations } = checkScriptContent(content);
  auditDenyListCheck(id, allowed, violations);
  if (!allowed) {
    throw new Error(`Script blocked by security policy: ${violations.join(', ')}`);
  }

  return content;
}

export function extractScriptToTemp(id: string): string {
  const script = getScriptById(id);
  if (!script) throw new Error(`Script not found: ${id}`);

  const tempDir = getScriptTempDir();
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const content = getScriptContent(id);
  const safeName = script.name.replace(/[/\\:*?"<>|]/g, '_');
  const filePath = resolve(tempDir, `${safeName}.${script.extension}`);

  const pathValidation = validateScriptPath(filePath);
  if (!pathValidation.valid) {
    throw new Error(pathValidation.error);
  }

  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}
