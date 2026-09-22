import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WORDS,tr,modelText,checkText,exportMarkdown} from '../delivery_note/web/review-ui.mjs';
import {evaluateGeneral,prepareGeneral} from '../delivery_note/web/general-engine.mjs';
const load=name=>JSON.parse(fs.readFileSync(new URL('../delivery_note/web/'+name,import.meta.url),'utf8'));
const s=load('semantic-sample.json'),record=load('semantic-recording.json');
const {report}=await evaluateGeneral(s.objective,s.documents,record.response);
report.provenance.mode='recorded-serv-browser-response';
test('every interface entry has independent Chinese and English text',()=>{for(const [key,pair]of Object.entries(WORDS)){assert.equal(pair.length,2,key);assert(pair.every(s=>typeof s==='string'&&s.trim()),key);}assert.equal(tr('zh','step1'),'目的与材料');});
test('readable exports do not mutate evidence or exact source quotations',()=>{const before=JSON.stringify(report);for(const lang of ['zh','en']){const md=exportMarkdown(report,lang);assert(md.includes(report.results[0].evidence[0].quote));assert(!md.includes('Computed material observations /'));}assert.equal(JSON.stringify(report),before);});
test('count presentation preserves actual, expected and total without inferring acceptance',()=>{const e=report.measured.evidence.find(x=>x.method==='csv_count_where');assert.match(checkText(e,'zh'),/实际匹配 10 条，预期 12 条（共 12 条）/);assert.equal(e.status,'fail');});
test('arbitrary model prose is never rewritten as a canned sample finding',()=>{const x='Custom outcome; exact untrusted user text.';assert.equal(modelText(x,'en',false),x);assert.equal(modelText(x,'zh',true),x);});


test('English review preparation is English-first while preserving source text',async()=>{
  assert.equal(typeof s.objective_en,'string');
  const prepared=await prepareGeneral(s.objective_en,s.documents,'en');
  assert.match(prepared.prompt,/You are a general-purpose delivery auditor/);
  assert.match(prepared.prompt,/Customer objective:/);
  assert.match(prepared.prompt,/Review the September 22, 2026 training delivery report/);
  assert.match(prepared.prompt,/P11,pending/);
  assert.doesNotMatch(prepared.prompt,/你是通用交付审查员/);
});
