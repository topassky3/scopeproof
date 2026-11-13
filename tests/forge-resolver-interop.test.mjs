import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ResolverModule from '@forge/resolver';

test('Forge resolver constructor can be instantiated from ESM', () => {
  const Resolver = ResolverModule.default ?? ResolverModule;
  assert.equal(typeof Resolver, 'function');
  const resolver = new Resolver();
  assert.equal(typeof resolver.define, 'function');
  assert.equal(typeof resolver.getDefinitions, 'function');
});

test('deployed Forge entry unwraps the CommonJS default export', () => {
  const entry = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.match(entry, /import ResolverModule from ['"]@forge\/resolver['"]/);
  assert.match(entry, /const Resolver = ResolverModule\.default \?\? ResolverModule;/);
  assert.match(entry, /export const handler = resolver\.getDefinitions\(\);/);
});
