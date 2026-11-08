import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('shared layout and design primitives are in src/shared', () => {
  for (const path of [
    'shared/layout/AppShell.tsx', 'shared/components/ui.tsx',
    'shared/config/navigation.ts', 'shared/styles/base.css',
    'shared/styles/design-system.css', 'shared/types/review.ts',
  ]) assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
});

test('each main screen has a feature module, and React bootstrapping stays minimal', () => {
  for (const path of [
    'features/overview/OverviewPage.tsx', 'features/reviews/ReviewsPage.tsx',
    'features/requirements/RequirementsPage.tsx', 'features/evidence/EvidencePage.tsx',
    'features/history/HistoryPage.tsx', 'features/reports/ReportsPage.tsx',
    'features/settings/SettingsPage.tsx',
  ]) assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
  const entry = read('main.tsx');
  assert.match(entry, /import \{ App \} from '\.\/app\/App'/);
  assert.doesNotMatch(entry, /applyCommand|summarize|fetchReview/);
});

test('relative TS/TSX imports resolve without broken paths', () => {
  // Enumerate the newly refactored source files rather than requiring TS runtime support.
  const files = [
    'main.tsx', 'app/App.tsx', 'shared/layout/AppShell.tsx',
    'shared/components/ui.tsx', 'shared/config/navigation.ts',
    ...['overview/OverviewPage', 'reviews/ReviewsPage', 'reviews/ReviewWorkspace',
      'requirements/RequirementsPage', 'evidence/EvidencePage',
      'history/HistoryPage', 'reports/ReportsPage', 'settings/SettingsPage'].map(p => `features/${p}.tsx`),
  ];
  for (const file of files) {
    const contents = read(file);
    for (const match of contents.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const target = resolve(dirname(resolve(root, file)), match[1]);
      assert.ok([target, `${target}.ts`, `${target}.tsx`, `${target}.js`, `${target}.css`].some(existsSync),
        `Missing relative import ${match[1]} from ${file}`);
    }
  }
});
