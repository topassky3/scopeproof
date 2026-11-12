import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
const overview = readFileSync(new URL('../src/features/overview/OverviewPage.tsx', import.meta.url), 'utf8');
const history = readFileSync(new URL('../src/features/history/HistoryPage.tsx', import.meta.url), 'utf8');
const local = readFileSync(new URL('../src/features/reviews/LocalReviewsPage.tsx', import.meta.url), 'utf8');

test('Django session persistence only takes over the Reviews tab', () => {
  assert.match(app, /Boolean\(localUsername && csrfToken\) && active === 'Reviews'/);
  assert.match(app, /sessionReviews \? <LocalReviewsPage csrfToken=\{csrfToken!\}/);
  assert.doesNotMatch(app, /\b(?:createLocalReview|commandLocalReview|listLocalReviews)\b/);
  assert.match(local, /commandLocalReview/);
  assert.match(local, /ReviewWorkspace/);
});

test('Existing six sections remain routed by the original AppShell', () => {
  for (const name of ['Overview', 'Requirements', 'Evidence', 'History', 'Reports', 'Settings']) {
    assert.match(app, new RegExp("active === '" + name + "' && <" + name + "Page"));
  }
  assert.doesNotMatch(overview, /\blocalMode\b/);
  assert.doesNotMatch(history, /buildHistoryEntries/);
});
