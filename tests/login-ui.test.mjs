import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');

test('standalone login and dashboard use separate URLs with a Django session gate', () => {
  const entry = read('src/app/Entry.tsx');
  assert.match(entry, /\/api\/local\/auth\/session\//);
  assert.match(entry, /'\/dashboard'/);
  assert.match(entry, /'\/login'/);
  assert.match(entry, /!session\.authenticated/);
  assert.match(entry, /fetch\('\/api\/local\/auth\/logout\//);
  assert.match(entry, /if \(!standalone\) return <App \/>/);
});

test('login visual remains isolated and responsive', () => {
  assert.ok(existsSync(resolve(root, 'src/features/auth/LoginPage.tsx')));
  assert.ok(existsSync(resolve(root, 'src/features/auth/login-form.css')));
  const css = read('src/features/auth/login.css');
  assert.match(css, /\.sp-login-main/);
  assert.match(css, /@media\(max-width:600px\)/);
});

test('actual credential form uses Django auth endpoints with CSRF', () => {
  const login = read('src/features/auth/LoginPage.tsx');
  assert.match(login, /type=\{showPassword \? 'text' : 'password'\}/);
  assert.match(login, /'X-CSRFToken': csrfToken/);
  assert.match(login, /credentials: 'same-origin'/);
  assert.match(login, /\/api\/local\/auth\/\$\{endpoint\}/);
  assert.match(login, /onAuthenticated\(data as LocalSession\)/);
  assert.doesNotMatch(login, /Continue with Atlassian/);
});

test('Vite forwards standalone auth API to Django without opening an auth bypass', () => {
  const vite = read('vite.config.js');
  assert.match(vite, /'\/api\/local'/);
  assert.match(vite, /127\.0\.0\.1:8000/);
  const settings = read('backend/config/settings.py');
  assert.match(settings, /CsrfViewMiddleware/);
  assert.match(settings, /SessionMiddleware/);
  assert.match(settings, /SCOPEPROOF_STANDALONE_AUTH/);
});
