import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {captureEditorContext,editorContextMatches} from '../src/app/editor-context.mjs';
import {groupPdfContent} from '../src/features/reports/pdf-layout.mjs';
const review=()=>({issueId:'101',issueKey:'QA-1',projectId:'2',revision:4,requirements:[{id:'RQ-01',version:1,title:'First check'},{id:'RQ-02',version:2,title:'Second check'}]});
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Quality: exact target, version and description captured without a default',()=>{
 const r=review();assert.equal(captureEditorContext(r,'evidence'),null);assert.equal(captureEditorContext(r,'evidence','unknown'),null);
 const ctx=captureEditorContext(r,'evidence','RQ-02');assert.deepEqual(ctx.target,{id:'RQ-02',version:2,title:'Second check'});assert.ok(editorContextMatches(r,ctx));
});
test('Quality: editor refuses different issue, project, revision or requirement version/text',()=>{
 const r=review(),ctx=captureEditorContext(r,'evidence','RQ-02');
 for(const fields of [{issueId:'102'},{issueKey:'QA-2'},{projectId:'3'},{revision:5}])assert.equal(editorContextMatches({...r,...fields},ctx),false);
 for(const fields of [{version:3},{title:'Changed'}]){const copy=structuredClone(r);Object.assign(copy.requirements[1],fields);assert.equal(editorContextMatches(copy,ctx),false);}
 assert.equal(editorContextMatches({...r,requirements:[r.requirements[0]]},ctx),false);
});
test('Quality: duplicate targets refused and non-target editors bound to revision',()=>{
 const r=review();r.requirements.push({...r.requirements[1]});assert.equal(captureEditorContext(r,'evidence','RQ-02'),null);
 const ctx=captureEditorContext(r,'reject');assert.ok(editorContextMatches(r,ctx));assert.equal(editorContextMatches({...r,revision:5},ctx),false);
});
test('Quality: PDF layout preserves exact order and content, keeping short evidence together',()=>{
 const nodes=[{text:'03 / Evidence',style:'section'},{text:'EV-101',bold:true},{text:'Test title'},{text:'Passed'},{text:'EV-102',bold:true},{text:'Second title'},{text:'Passed'}];
 const before=structuredClone(nodes),out=groupPdfContent(nodes);assert.deepEqual(out.flatMap(x=>x.stack??[x]),nodes);assert.deepEqual(nodes,before);assert.equal(out.length,2);assert.ok(out.every(x=>x.unbreakable));
});
test('Quality: oversized content remains breakable, no historical content truncated',()=>{
 const nodes=[{text:'Decision',bold:true},{text:'x'.repeat(3000)},...Array.from({length:100},(_,i)=>({text:`RQ-${i} | EV-${i}`}))];const out=groupPdfContent(nodes);
 assert.deepEqual(out.flatMap(x=>x.stack??[x]),nodes);assert.ok(out.includes(nodes[1]));assert.ok(out.filter(x=>x.stack).every(x=>x.stack.length<=12));
});
test('Quality wiring: Evidence requires an explicit choice scoped to issue and revision',()=>{
 const s=source('src/features/evidence/EvidencePage.tsx');assert.match(s,/Select a requirement/);assert.doesNotMatch(s,/review\.requirements\[0\]\?\.id/);assert.match(s,/disabled=\{!targetRequirementId\}/);assert.match(s,/key=\{JSON\.stringify\(\[props\.review\.issueKey, props\.review\.revision\]\)\}/);assert.match(s,/setRequirementId\(''\)/);
});
test('Quality wiring: modal verifies context for all environments and displays full target',()=>{
 const s=source('src/app/App.tsx');assert.match(s,/!editorContextMatches\(review,editorContext\)/);assert.match(s,/editorContext\.target\.title/);assert.match(s,/editorContext\.issueKey/);assert.match(s,/editorContext\.target\.version/);assert.match(s,/requirementId:target,title,url:link,result/);assert.doesNotMatch(s,/preview && editorRevision !== review\.revision/);
});
test('Quality wiring: retained evidence is visible without expanding details',()=>{
 for(const p of ['src/features/overview/OverviewPage.tsx','src/features/reviews/ReviewPlanPanel.tsx']){const s=source(p);assert.match(s,/Retained evidence \(/);assert.match(s,/row\.evidenceId/);assert.doesNotMatch(s,/<details[^>]*><summary>Retained evidence/);}
});
test('Quality wiring: PDF uses bounded layout and preserves explicit report guard',()=>{
 const s=source('src/features/reports/pdf-report.mjs');assert.match(s,/content:groupPdfContent\(content\)/);assert.match(s,/if \(!canPublishReport\(review, summary, reportDiagnostic\)\)/);
});
