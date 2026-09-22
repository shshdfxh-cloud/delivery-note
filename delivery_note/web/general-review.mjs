import {prepareGeneral,evaluateGeneral} from './general-engine.mjs';
import {REVIEW_LIMITS} from './semantic.mjs';
import {tr,WORDS,modelText,checkText,sourceMode,isSampleReport,exportMarkdown} from './review-ui.mjs';

const $=id=>document.getElementById(id);
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
const enc=new TextEncoder();
let lang='en';try{lang=new URL(location.href).searchParams.get('lang')||localStorage.getItem('delivery-note-language-v2')||'en';}catch{}if(!['zh','en'].includes(lang))lang='en';
let docs=[],prepared=null,report=null,generation=0,busy=false,capabilities={},sampleMode=false,sampleData=null;
let waitCancelled=false;
let currentTab='review',notice=null,errorInfo=null,recordingInfo=null,currentFacts=[],controller=null,pendingJob=null;
const t=(k,v)=>tr(lang,k,v);
const liveAvailable=()=>capabilities.mode==='live'&&capabilities.node_available!==false&&(capabilities.agent_review_available||capabilities.serv_configured);
const cancel=node('button',undefined,'button quiet');cancel.id='cancel-wait';cancel.type='button';cancel.hidden=true;
const resume=node('button',undefined,'button secondary');resume.id='resume-wait';resume.type='button';resume.hidden=true;
const waitingButtons=node('div',undefined,'button-row');waitingButtons.append(cancel,resume);$('handoff').append(waitingButtons);

function setNotice(key,vars={}){notice=key?{key,vars}:null;$('packet-state').hidden=!notice;$('packet-state').textContent=notice?t(key,vars):'';}
function clearError(){errorInfo=null;$('error').hidden=true;$('error').replaceChildren();}
function showError(e){
 const raw=String(e?.message||e),own=Object.hasOwn(WORDS,raw);
 let key=own?raw:/引文|引用文件|行号|目标引用/.test(raw)?'errQuote':/不匹配/.test(raw)?'errStale':/decode|encoded|UTF-8|二进制|空文件/.test(raw)?'errType':/JSON|Unexpected token|Unexpected end/.test(raw)?'errJSON':/超过|超限|120,000|120000|1–12/.test(raw)?'errLimit':'errGeneric';
 errorInfo={key,raw:own?'':raw};renderError();$('error').focus({preventScroll:true});$('error').scrollIntoView({block:'nearest'});
}
function renderError(){if(!errorInfo)return;$('error').hidden=false;$('error').replaceChildren(node('p',t(errorInfo.key)));if(errorInfo.raw){const d=node('details');d.append(node('summary',t('errorDetails')),node('pre',errorInfo.raw));$('error').append(d);}}
function controls(){
 for(const id of ['build','sample','replay','reset','files-input','objective','consent','general-runtime','response'])$(id).disabled=busy;
 $('replay').textContent=t(busy?'running':'runSample');$('build').textContent=t('build');
 for(const id of ['copy','save-packet','import'])$(id).disabled=busy||!prepared;
 $('live-section').hidden=!liveAvailable();$('live').disabled=busy||!prepared||!(capabilities.remaining_calls>0)||!!pendingJob;
 $('live').textContent=t(capabilities.agent_review_available?'liveAgent':'liveApi');
 $('live-description').textContent=t(capabilities.remaining_calls<=0?'noCalls':capabilities.agent_review_available?'localAgent':'localApi');
 $('mode').textContent=t(capabilities.mode==='live'?'modeLocal':'modeStatic');
 $('review-empty').hidden=!!prepared;$('handoff').hidden=!prepared;
 $('report-empty').hidden=!!report;$('report').hidden=!report;$('report-dot').hidden=!report;
 $('download-json').disabled=!report;$('download-md').disabled=!report;
 $('files-empty').hidden=!!docs.length;$('file-count').textContent=t('fileCount',{n:docs.length});$('char-count').textContent=$('objective').value.length+' / 4000';
 $('measured-wrap').hidden=!currentFacts.length;
 cancel.textContent=t('stopWait');cancel.hidden=!controller;resume.textContent=t('resumeWait');resume.hidden=!pendingJob||busy;
 const step=report?3:prepared?2:1;for(let i=1;i<=3;i++){if(i===step)$('step-'+i).setAttribute('aria-current','step');else $('step-'+i).removeAttribute('aria-current');}
}
function setBusy(v){busy=v;controls();for(const e of $('files').querySelectorAll('button,select'))e.disabled=v;}
function selectTab(name,scroll=false){
 currentTab=name;for(const id of ['review','report']){const active=id===name;$('tab-'+id).setAttribute('aria-selected',String(active));$('tab-'+id).tabIndex=active?0:-1;$(id+'-view').hidden=!active;}
 if(scroll)$('tab-'+name).scrollIntoView({block:'start'});
}
function invalidate(note='invalidated'){
 generation++;prepared=null;report=null;pendingJob=null;currentFacts=[];recordingInfo=null;
 $('prompt').value='';$('response').value='';$('measured').replaceChildren();$('recording-state').hidden=true;
 clearError();setNotice(note);controls();
}
function resetReport(note='responseChanged'){report=null;clearError();setNotice(note);controls();}
function renderFiles(){
 $('files').replaceChildren();for(const [i,d] of docs.entries()){
  const row=node('div',undefined,'document-row'),info=node('div',undefined,'file-info');
  info.append(node('span',d.name,'file-name'),node('span',t('bytes',{n:enc.encode(d.content).length.toLocaleString()}),'file-size'));
  const role=node('select');for(const value of ['reference','deliverable']){const o=node('option',t(value));o.value=value;role.append(o);}role.value=d.role;role.disabled=busy;role.setAttribute('aria-label',t('fileRole',{name:d.name}));
  role.addEventListener('change',()=>{d.role=role.value;sampleMode=false;sampleData=null;invalidate();});
  const remove=node('button','×','remove');remove.type='button';remove.disabled=busy;remove.title=t('remove',{name:d.name});remove.setAttribute('aria-label',remove.title);remove.addEventListener('click',()=>{docs.splice(i,1);sampleMode=false;sampleData=null;invalidate();renderFiles();});
  row.append(node('span',d.name.split('.').pop().toUpperCase().slice(0,4),'file-icon'),info,role,remove);$('files').append(row);
 }
 controls();
}
function renderFacts(facts){
 currentFacts=facts;$('measured').replaceChildren();$('measured-count').textContent=t('measuredCount',{n:facts.length});
 for(const f of facts){const row=node('div',undefined,'measured-file');row.append(node('strong',f.file));
  const key=f.status==='fail'?'parseFailed':f.kind==='csv'?'csvInfo':f.kind==='json'?'jsonInfo':'textInfo';row.append(node('p',t(key,{rows:f.records,cols:f.columns?.length,bytes:f.bytes})));
  const groups=(f.value_counts||[]).filter(x=>x.values&&x.distinct<=6);for(const group of groups){const tags=node('div',undefined,'value-tags');for(const v of group.values)tags.append(node('span',group.column+' = '+v.value+' · '+v.count));row.append(tags);}
  if(f.status==='fail'){const detail=node('details');detail.append(node('summary',t('errorDetails')),node('pre',f.observation));row.append(detail);}$('measured').append(row);
 }
 controls();
}
function display(r){
 report=r;const sample=isSampleReport(r),text=s=>modelText(s,lang,sample);
 const decision=r.status==='advisory_needs_correction'?'needsCorrection':r.status==='advisory_evidence_incomplete'?'incomplete':'advisory';
 $('decision').className='decision '+(decision==='incomplete'?'unverified':decision==='advisory'?'supported':'fail');
 $('decision').replaceChildren(node('strong',t(decision)),node('p',t(decision==='needsCorrection'?'needsCorrectionBody':decision==='incomplete'?'incompleteBody':'advisoryBody')));
 $('provenance-label').textContent=t(sourceMode(r));$('stats').replaceChildren();
 for(const [status,label] of [['contradicted','countContradicted'],['unverified','countUnknown'],['supported','countSupported']]){const box=node('div',undefined,status);box.append(node('strong',String(r.results.filter(x=>x.status===status).length)),node('span',t(label)));$('stats').append(box);}
 $('summary').textContent=text(r.summary);$('translation-note').hidden=false;$('translation-note').textContent=t(sample?'translationNote':'sourceLanguageNote');
 $('results').replaceChildren();
 for(const x of r.results){
  const item=node('article',undefined,'finding');item.dataset.requirement=x.id;
  const head=node('div',undefined,'finding-top');head.append(node('span',x.id+' · '+t(x.layer),'finding-id'),node('span',t(x.status),'status-pill '+x.status));
  const body=node('div',undefined,'finding-body');body.append(node('h4',text(x.criterion)),node('p',t('goalReference',{text:text(x.goal_quote)}),'goal-reference'),node('p',text(x.reason),'finding-reason'));
  for(const q of x.evidence){const detail=node('details',undefined,'source-detail');detail.append(node('summary',t('quoteTitle',{file:q.file,start:q.start,end:q.end})),node('blockquote',q.quote),node('small','SHA-256 · '+q.sha256));body.append(detail);}
  if(!x.evidence.length)body.append(node('p',t('missingSource'),'helper'));
  for(const e of r.measured?.evidence.filter(e=>e.requirement_id===x.id)||[]){const m=node('section',undefined,'machine-check'),mh=node('div',undefined,'machine-heading');mh.append(node('span',t('measuredLabel')+' · '+t(e.method)),node('span',t(e.status),'status-pill '+e.status));m.append(mh,node('p',checkText(e,lang)));const raw=node('details');raw.append(node('summary',t('rawEvidence')),node('pre',e.observation));m.append(raw);body.append(m);}
  if(x.downgrade_reason)body.append(node('p',t('genericCheckUnknown'),'helper'));
  const next=node('div',undefined,'next-action');next.append(node('strong',t('nextAction')),node('span',text(x.next_check)));item.append(head,body,next);$('results').append(item);
 }
 $('verification').textContent=JSON.stringify({objective:r.objective,packet_id:r.packet_id,created_at:r.created_at,verification:r.verification,provenance:r.provenance,inventory:r.inventory,limitations:r.limitations,runtime_warning:r.runtime_warning,model_findings:r.results},null,2);
 renderFacts(r.material_observations||[]);controls();
}
function renderLanguage(){
 document.documentElement.lang=lang==='zh'?'zh-CN':'en';
 if(sampleMode&&sampleData){$('objective').value=lang==='en'?(sampleData.objective_en||sampleData.objective):sampleData.objective;}document.title='Delivery Note · '+(lang==='zh'?'通用交付审查':'General delivery review');
 for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
 for(const el of document.querySelectorAll('[data-i18n-placeholder]'))el.placeholder=t(el.dataset.i18nPlaceholder);
 for(const el of document.querySelectorAll('[data-i18n-aria]'))el.setAttribute('aria-label',t(el.dataset.i18nAria));
 $('language').textContent=lang==='zh'?'EN':'中文';$('language').setAttribute('aria-label',lang==='zh'?'Switch to English':'切换到中文');
 if(notice)setNotice(notice.key,notice.vars);if(recordingInfo)$('recording-state').textContent=t('recordedNote',recordingInfo);
 renderFiles();if(report)display(report);else if(currentFacts.length)renderFacts(currentFacts);renderError();controls();
}
async function asset(name){const r=await fetch(name,{cache:'no-store'});if(!r.ok)throw Error('errLoad');return r.json();}
function confirmReplace(){return !(docs.length||$('objective').value.trim())||sampleMode||confirm(t('confirmReplace'));}
async function loadSample(replay=false){
 if(busy||!confirmReplace())return;invalidate(null);setBusy(true);const version=generation;
 try{const s=await asset('semantic-sample.json');if(version!==generation)return;sampleData=s;docs=structuredClone(s.documents);$('objective').value=lang==='en'?(s.objective_en||s.objective):s.objective;sampleMode=true;$('consent').checked=false;renderFiles();
  if(replay){const record=await asset('semantic-recording.json');const result=await evaluateGeneral(s.objective,s.documents,record.response);if(version!==generation)return;
   result.report.provenance={...result.report.provenance,mode:'recorded-serv-browser-response',model:record.model,recorded_at:record.recorded_at,recording_capture:record.capture,serv_called_this_run:false};
   display(result.report);recordingInfo={date:record.recorded_at};$('recording-state').textContent=t('recordedNote',recordingInfo);$('recording-state').hidden=false;selectTab('report',true);
  }else{selectTab('review');$('objective').focus({preventScroll:true});}
 }catch(e){showError(e);}finally{setBusy(false);}
}
async function upload(list){
 if(busy||!list.length)return;invalidate();setBusy(true);const version=generation;
 try{
  if(docs.length+list.length>REVIEW_LIMITS.files||docs.reduce((n,d)=>n+enc.encode(d.content).length,0)+list.reduce((n,f)=>n+f.size,0)>REVIEW_LIMITS.bytes)throw Error('errLimit');
  const additions=[];for(const f of list){if(!/\.(txt|md|csv|json|html?|js|mjs|py|ts|css|xml|ya?ml|log)$/i.test(f.name)||!f.size)throw Error('errType');const content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await f.arrayBuffer());additions.push({name:f.name,role:'deliverable',content});}
  const candidate=[...docs,...additions];await prepareGeneral($('objective').value||'Pending customer objective',candidate,lang);if(version!==generation)return;docs=candidate;sampleMode=false;sampleData=null;selectTab('review');renderFiles();
 }catch(e){showError(e);}finally{$('files-input').value='';setBusy(false);}
}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=node('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
$('language').addEventListener('click',()=>{lang=lang==='zh'?'en':'zh';try{localStorage.setItem('delivery-note-language-v2',lang);const url=new URL(location.href);if(url.searchParams.has('lang')){url.searchParams.set('lang',lang);history.replaceState(null,'',url);}}catch{}renderLanguage();});
for(const name of ['review','report']){$('tab-'+name).addEventListener('click',()=>selectTab(name));$('tab-'+name).addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'review':e.key==='End'?'report':name==='review'?'report':'review';selectTab(next);$('tab-'+next).focus();}});}
$('replay').addEventListener('click',()=>loadSample(true));$('sample').addEventListener('click',()=>loadSample(false));
$('reset').addEventListener('click',()=>{if(busy||!confirmReplace())return;docs=[];$('objective').value='';$('consent').checked=false;$('general-runtime').checked=false;sampleMode=false;sampleData=null;invalidate(null);renderFiles();selectTab('review');});
$('objective').addEventListener('input',()=>{sampleMode=false;sampleData=null;invalidate();});$('consent').addEventListener('change',()=>invalidate());
$('general-runtime').addEventListener('change',()=>resetReport());
$('files-input').addEventListener('change',e=>upload(Array.from(e.target.files)));
for(const event of ['dragover','dragenter'])$('dropzone').addEventListener(event,e=>{e.preventDefault();if(!busy)$('dropzone').classList.add('dragging');});
for(const event of ['dragleave','drop'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('dragging');if(event==='drop')upload(Array.from(e.dataTransfer.files));});
$('build').addEventListener('click',async()=>{
 if(busy)return;invalidate(null);const version=generation;setBusy(true);
 try{if(!$('objective').value.trim())throw Error('errGoal');if(!docs.some(d=>d.role==='deliverable'))throw Error('errFiles');if(!$('consent').checked)throw Error('errConsent');const candidate=await prepareGeneral($('objective').value,docs,lang);if(version!==generation)return;prepared=candidate;$('prompt').value=candidate.prompt;renderFacts(candidate.facts);setNotice('preparedNote');selectTab('review',true);}catch(e){showError(e);}finally{setBusy(false);}
});
$('copy').addEventListener('click',async()=>{if(!prepared||busy)return;try{await navigator.clipboard.writeText($('prompt').value);setNotice('copied');}catch{$('preview-details').open=true;$('prompt').focus();$('prompt').select();setNotice('copyFallback');}});
$('save-packet').addEventListener('click',()=>{if(prepared)download('delivery-review-packet.json',JSON.stringify(prepared.packet,null,2),'application/json');});
$('import').addEventListener('click',async()=>{
 if(!prepared||busy)return;resetReport(null);const version=generation;setBusy(true);
 try{if(!$('response').value.trim())throw Error('errJSON');const out=await evaluateGeneral(prepared.packet.objective,docs,$('response').value,{},lang);if(version!==generation)return;display(out.report);setNotice('complete');selectTab('report',true);}catch(e){showError(e);}finally{setBusy(false);}
});
$('response').addEventListener('input',()=>resetReport());
async function waitForJob(signal){
 while(true){if(signal.aborted)throw new DOMException('Aborted','AbortError');const response=await fetch('/api/agent-jobs/'+pendingJob.id,{signal,cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'errGeneric');if(data.status==='complete')return data;await new Promise(r=>setTimeout(r,1500));}
}
async function runLive(resuming=false){
 if(busy||!prepared||!liveAvailable())return;if(!$('consent').checked)return showError('errConsent');if(pendingJob&&!resuming)return;
 const version=generation;setBusy(true);clearError();report=null;waitCancelled=false;controller=new AbortController();controls();const signal=controller.signal;const timer=setTimeout(()=>controller?.abort(),240000);
 try{
  let data;if(resuming){setNotice('awaiting',{id:pendingJob.id});data=await waitForJob(signal);}else{
   setNotice('sending');const response=await fetch('/api/general-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({objective:prepared.packet.objective,documents:structuredClone(docs),language:lang,consent:true,execute_browser:$('general-runtime').checked,execution_consent:$('general-runtime').checked}),signal});data=await response.json();if(!response.ok)throw Error(data.error||'errGeneric');
   if(response.status===202&&data.job_id){pendingJob={id:data.job_id,version};capabilities.remaining_calls=data.remaining_calls;setNotice('awaiting',{id:data.job_id});data=await waitForJob(signal);}
  }
  if(version!==generation)return;capabilities.remaining_calls=data.remaining_calls;pendingJob=null;$('response').value=JSON.stringify(data.response,null,2);display(data.report);setNotice('complete');selectTab('report',true);
 }catch(e){if(e.name==='AbortError')setNotice(waitCancelled?'stopped':'timeout');else showError(e);}finally{clearTimeout(timer);controller=null;setBusy(false);}
}
$('live').addEventListener('click',()=>runLive());resume.addEventListener('click',()=>runLive(true));cancel.addEventListener('click',()=>{waitCancelled=true;controller?.abort();setNotice('stopped');});
$('download-json').addEventListener('click',()=>{if(report)download('delivery-review-evidence.json',JSON.stringify(report,null,2),'application/json');});
$('download-md').addEventListener('click',()=>{if(report)download('delivery-review-'+lang+'.md',exportMarkdown(report,lang),'text/markdown;charset=utf-8');});
renderLanguage();selectTab('review');
if(['localhost','127.0.0.1'].includes(location.hostname))fetch('/api/status',{signal:AbortSignal.timeout(3000)}).then(async r=>{if(r.ok){capabilities=await r.json();controls();}}).catch(()=>{});
