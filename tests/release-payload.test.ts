import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..');
const payloadScript = join(repoRoot, 'scripts', 'release-payload.ps1');

type ReleasePayload = {
  tag_name: string;
  name: string;
  body: string;
};

function payloadFrom(body: string): ReleasePayload {
  const base64 = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-File', payloadScript, '-Tag', 'v2.23.0', '-Body', body],
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();

  // O GitHub rejeita JSON que nao e UTF-8 valido com "Problems parsing JSON".
  const json = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(base64, 'base64'));
  return JSON.parse(json) as ReleasePayload;
}

test('codifica corpo acentuado como UTF-8 no payload da release', () => {
  const body = 'Windhawk (mods de personalização) em Essenciais PC.';

  expect(payloadFrom(body)).toEqual({
    tag_name: 'v2.23.0',
    name: 'v2.23.0',
    body,
  });
});
