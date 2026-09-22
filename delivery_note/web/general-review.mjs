import {prepareGeneral,evaluateGeneral,generalMarkdown} from './general-engine.mjs';
import {REVIEW_LIMITS} from './semantic.mjs';
const $=id=>document.getElementById(id),node=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=value;return e;};
let docs=[],prepared=null,report=null,generation=0,busy=false,capabilities={};
const notify=x=>$('error').textContent=x;
const liveAvailable=()=>capabilities.mode==='live'&&(capabilities.agent_review_available||capabilities.serv_configured);
function controls(){for(const id of ['build','sample','replay','files-input','objective','consent','general-runtime'])$(id).disabled=busy;$('live').hidden=!liveAvailable();$('live').disabled=busy||!prepared||!(capabilities.remaining_calls>0);$('import').disabled=busy||!prepared;$('copy').disabled=busy||!prepared;$('save-packet').disabled=busy||!prepared;}
function invalidate(){generation++;prepared=null;report=null;$('prompt').value='';$('response').value='';$('report').hidden=true;$('measured').textContent='';$('recording-state').textContent='';$('packet-state').textContent='材料、目的或授权改变后，需要重新整理审查包。';notify('');controls();}
function renderFiles(){
 $('files').replaceChildren();for(const [i,d]of docs.entries()){const row=node('div');row.className='document-row';row.append(node('span',d.name));const select=node('select');for(const [v,t]of [['reference','依据'],['deliverable','交付']]){const o=node('option',t);o.value=v;select.append(o);}select.value=d.role;select.disabled=busy;select.setAttribute('aria-label',d.name+' 材料角色');select.addEventListener('change',()=>{d.role=select.value;invalidate();});const remove=node('button','移除');remove.disabled=busy;remove.addEventListener('click',()=>{docs.splice(i,1);invalidate();renderFiles();});row.append(select,remove);$('files').append(row);}
}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=node('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function asset(name){const r=await fetch(name,{cache:'no-store'});if(!r.ok)throw Error(name+' 加载失败');return r.json();}
function observed(facts){$('measured').textContent=facts.map(f=>{
 const counts=(f.value_counts||[]).filter(x=>x.values&&x.distinct<=6).map(x=>x.column+': '+x.values.map(v=>v.value+' = '+v.count).join(', ')).join(' | ');
 return f.file+' · '+f.status+' · '+f.bytes+' bytes\n'+f.observation+(counts?'\n'+counts:'');
}).join('\n\n');}
function display(r){
 report=r;$('report').hidden=false;$('decision').className='decision'+(r.status==='advisory_only'?'':' issue');$('decision').textContent=r.status==='advisory_needs_correction'?'Needs correction / 需要修改 · 材料矛盾或实测失败':r.status==='advisory_evidence_incomplete'?'Evidence incomplete / 证据不足 · 尚不能证实客户目的':'材料有支持 · 仍需确认覆盖范围，不是自动终验通过';
 $('summary').textContent=r.summary;$('results').replaceChildren();const labels={supported:'材料支持（AI判断）',contradicted:'发现矛盾（AI判断）',unverified:'未验证'};
 for(const x of r.results){const a=node('article');a.append(node('h3',x.id+' · '+labels[x.status]+' · '+x.criterion),node('p','对应目的：'+x.goal_quote),node('p',x.reason));for(const q of x.evidence){const detail=node('details');detail.append(node('summary',q.file+':'+q.start+'–'+q.end+' · 查看已核对的原文 / Exact source'),node('blockquote',q.quote));a.append(detail);}if(x.downgrade_reason)a.append(node('p',x.downgrade_reason));
  for(const e of r.measured?.evidence.filter(e=>e.requirement_id===x.id)||[])a.append(node('p','实际检查 · '+e.status+' · '+e.method),node('pre',e.observation));
  a.append(node('p','下一步：'+x.next_check));$('results').append(a);}
 const source=(r.provenance.mode||'')+(r.provenance.recorded_at?' · '+r.provenance.recorded_at:'');
 $('verification').textContent=JSON.stringify({source,verification:r.verification,provenance:r.provenance,limitations:r.limitations,runtime_warning:r.runtime_warning},null,2);observed(r.material_observations||[]);
}
$('sample').addEventListener('click',async()=>{try{const s=await asset('semantic-sample.json');invalidate();docs=s.documents;$('objective').value=s.objective;$('consent').checked=false;renderFiles();}catch(e){notify(e.message);}});
$('replay').addEventListener('click',async()=>{
 if(busy)return;invalidate();const version=generation;busy=true;controls();renderFiles();
 try{const [s,record]=await Promise.all([asset('semantic-sample.json'),asset('semantic-recording.json')]);if(version!==generation)return;docs=s.documents;$('objective').value=s.objective;$('consent').checked=false;
  const result=await evaluateGeneral(s.objective,s.documents,record.response);if(version!==generation)return;
  result.report.provenance={...result.report.provenance,mode:'recorded-serv-browser-response',model:record.model,recorded_at:record.recorded_at,recording_capture:record.capture,serv_called_this_run:false};
  display(result.report);$('recording-state').textContent='已重新读取合成文件、计算记录与状态数量、逐字核对真实SERV录制回复。模型回复来自 '+record.recorded_at+' 的 '+record.model+'；这次点击未调用模型。';
 }catch(e){notify(e.message);}finally{busy=false;controls();renderFiles();}
});
$('files-input').addEventListener('change',async e=>{const list=Array.from(e.target.files);invalidate();const version=generation;try{if(!list.length)return;if(docs.length+list.length>REVIEW_LIMITS.files||list.reduce((s,f)=>s+f.size,0)>REVIEW_LIMITS.bytes)throw Error('文件数量或大小超限。');const additions=[];for(const f of list){const content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await f.arrayBuffer());additions.push({name:f.name,role:'deliverable',content});}if(version!==generation)return;const candidate=[...docs,...additions];await prepareGeneral($('objective').value||'尚未填写目的',candidate);if(version!==generation)return;docs=candidate;renderFiles();}catch(e){notify(e.message);}finally{e.target.value='';}});
$('general-runtime').addEventListener('change',invalidate);$('objective').addEventListener('input',invalidate);$('consent').addEventListener('change',invalidate);
$('build').addEventListener('click',async()=>{invalidate();const version=generation;try{if(!$('consent').checked)throw Error('请先确认这批完整文字可以交给模型，并查看发送预览。');const candidate=await prepareGeneral($('objective').value,docs);if(version!==generation)return;prepared=candidate;$('prompt').value=candidate.prompt;observed(candidate.facts);$('packet-state').textContent='材料包 '+prepared.packet.packet_id+'；尚未发送。可点击本地实时审查，或复制到已有模型标签页。';controls();}catch(e){notify(e.message);}});
$('copy').addEventListener('click',async()=>{try{if(!prepared)return;await navigator.clipboard.writeText($('prompt').value);$('packet-state').textContent='已复制，尚未发送。请在现有模型标签页粘贴并提交，再把完整JSON导回。';}catch{$('prompt').focus();$('prompt').select();notify('已选中审查包；按Ctrl+C复制。');}});
$('save-packet').addEventListener('click',()=>{if(prepared)download('delivery-review-packet.json',JSON.stringify(prepared.packet,null,2),'application/json');});
$('import').addEventListener('click',async()=>{report=null;$('report').hidden=true;notify('');const version=generation;try{if(!prepared)throw Error('请先重新整理材料包');const out=await evaluateGeneral(prepared.packet.objective,docs,$('response').value);if(version!==generation)return;display(out.report);}catch(e){notify(e.message);}});
$('live').addEventListener('click',async()=>{
 if(busy||!prepared)return;if(!$('consent').checked)return notify('请确认本次完整材料发送授权。');
 const version=generation;const objective=prepared.packet.objective,documents=structuredClone(docs);busy=true;report=null;$('report').hidden=true;notify('');controls();renderFiles();
 $('packet-state').textContent=capabilities.agent_review_available?'正在准备任务，交给现有AI助手使用已登录SERV标签；不会读取密钥。':'正在本地调用SERV并核对原文和实际检查。';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),240000);
 try{const response=await fetch('/api/general-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({objective,documents,consent:true,execute_browser:$('general-runtime').checked,execution_consent:$('general-runtime').checked}),signal:controller.signal});let data=await response.json();
  if(response.status===202&&data.job_id){
   $('packet-state').textContent='任务已准备，等待现有AI助手用已登录SERV标签提交并返回结果。任务编号：'+data.job_id;
   while(data.status!=='complete'){
    await new Promise(r=>setTimeout(r,2000));if(controller.signal.aborted)throw new DOMException('Timed out','AbortError');
    const poll=await fetch('/api/agent-jobs/'+data.job_id,{signal:controller.signal});const next=await poll.json();
    if(!poll.ok)throw Error(next.error||'任务查询失败');data={...next,job_id:data.job_id};
   }
  }
  if(version!==generation)return;if(!response.ok)throw Error(data.error||'审查失败');capabilities.remaining_calls=data.remaining_calls;$('response').value=JSON.stringify(data.response,null,2);display(data.report);
  $('packet-state').textContent='本次材料 → SERV → 原文核对 → 实际检查 → 报告已返回；本进程剩余 '+data.remaining_calls+' 次。';
 }catch(e){notify(e.name==='AbortError'?'浏览器请求超时；未自动重发。请检查SERV任务标签页是否已有结果。':e.message);try{const s=await fetch('/api/status');if(s.ok)capabilities=await s.json();}catch{}}
 finally{clearTimeout(timer);busy=false;controls();renderFiles();}
});
$('response').addEventListener('input',()=>{report=null;$('report').hidden=true;});
$('download-json').addEventListener('click',()=>{if(report)download('general-delivery-review.json',JSON.stringify(report,null,2),'application/json');});
$('download-md').addEventListener('click',()=>{if(report)download('general-delivery-review.md',generalMarkdown(report),'text/markdown;charset=utf-8');});
if(['localhost','127.0.0.1'].includes(location.hostname))fetch('/api/status').then(async r=>{if(r.ok){capabilities=await r.json();$('live').textContent=capabilities.agent_review_available?'交给现有AI助手审查 · 无需私钥':'本地SERV API自动审查';controls();}}).catch(()=>{});
controls();
