import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('dev script includes max-old-space-size flag', () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
  expect(pkg.scripts.dev).toContain('--max-old-space-size=192');
  expect(pkg.scripts.dev).toContain('--expose-gc');
});

test('start script includes max-old-space-size flag', () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
  expect(pkg.scripts.start).toContain('--max-old-space-size=192');
  // --expose-gc is only for dev, not production start
  expect(pkg.scripts.start).not.toContain('--expose-gc');
});