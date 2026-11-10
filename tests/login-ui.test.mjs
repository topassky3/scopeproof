import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');

test('local entry shows login concept and Forge opens Jira app directly', () => {
  const entry = read('app/Entry.tsx');
  assert.match(entry, /if \(!import\.meta\.env\.DEV\) return <App \/>/);
  assert.match(entry, /<LoginPage onEnterDemo=/);
  assert.match(entry, /<App \/>/);
});

test('login visual is isolated to an auth feature with responsive styles', () => {
  assert.ok(existsSync(resolve(root, 'features/auth/LoginPage.tsx')));
  const css = read('features/auth/login.css');
  assert.match(css, /\.sp-login-main/);
  assert.match(css, /@media\(max-width:600px\)/);
});

test('login does not collect Jira passwords or pretend to authenticate', () => {
  const login = read('features/auth/LoginPage.tsx');
  assert.doesNotMatch(login, /type=["']password["']/);
  assert.match(login, /Continue with Atlassian/);
  assert.match(login, /disabled aria-describedby=/);
  assert.match(login, /onClick=\{onEnterDemo\}/);
  assert.match(login, /sample data only/i);
});
