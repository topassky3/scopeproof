import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workspace=readFileSync(new URL('../src/features/reviews/ReviewWorkspace.tsx',import.meta.url),'utf8');
const wrapper=readFileSync(new URL('../src/features/reviews/ReviewsPage.tsx',import.meta.url),'utf8');
test('Shared Reviews workspace retains optional Forge-specific actions for Django consumers',()=>{
  assert.match(workspace,/onNewReview\?: \(\) => void/);
  assert.match(workspace,/onOpenEvidence\?: \(\) => void/);
  assert.match(workspace,/onNavigate: \(page: 'Requirements' \| 'History'\) => void/);
  assert.match(workspace,/\{onNewReview && <button/);
  assert.match(workspace,/\{onOpenEvidence && <button/);
  assert.match(wrapper,/onOpenEvidence=\{\(\) => props.onNavigate\('Evidence'\)\}/);
});
test('Reviews retains separate ready and in-review filter options',()=>{
  assert.match(workspace,/id:'ready',label:'Ready to approve'/);
  assert.match(workspace,/item.status === filter/);
});
