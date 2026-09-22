import {audit, inventory, validatePackage, validateRequirements, fileBytes, markdown, layerOf, LIMITS} from './core.mjs';
const $=id=>document.getElementById(id);
const words={
 zh:{legacy:'原版回放',source:'源代码 ↗',eyebrow:'通用交付审查 · 从客户目的出发',hero:'不只检查“交了什么”。<br><span>验证“有没有做到”。</span>',lede:'审查对象是交付成果，不限于网页。先拆解客户目的，再核对文件、事实与实际效果；当前已接入文本、数据文件和静态网页检查。',principleLabel:'一条不可跳过的规则',principle:'没有证据，不算通过。',principleBody:'AI提出检查计划并解释结果；实际文件和运行证据决定结论。',workspace:'交付验收工作台',trySample:'先看一个真实检查的例子',synthetic:'合成文件',custom:'＋ 检查自己的交付物',goalTitle:'先说明客户要什么',deliveryType:'交付类型',dataType:'数据 / 报告',webType:'静态网页 / 交互流程',generalType:'通用交付 / 自定义审查',filesTitle:'放入真实交付物和依据',chooseFiles:'选择文件',chooseFolder:'选择交付文件夹',fileHint:'支持UTF-8文本、CSV、JSON及静态网页；最多40个文件、共2 MiB。文件只保存在本次页面内存中。',roleHint:'“依据”是客户提供的原始材料；“交付”是待审查的结果。仅有交付物，不能证明原始事实正确。',contractTitle:'把目的变成可验收条件',starter:'生成本地检查起点',plan:'用SERV拆解目标 ↗',editContract:'查看 / 编辑精确验收规则',contractHint:'编辑后点击“应用规则”。没有可执行检查的条件会保留为“未验证”，不会被AI自动判为通过。',applyContract:'应用规则',scope:'这份验收条件覆盖本次客户目的；结论只在这个明确范围内成立。',runtime:'允许用独立、离线浏览器运行这些网页步骤（不使用我的登录态）。',aiSettings:'可选AI规划与解读 · 数据发送说明',aiDisclosure:'AI规划会向SERV发送目的、文件名、文件角色、CSV列名和HTML控件标识；AI解读会发送当前报告中的派生事实。供应商组织设置可能允许数据收集。不要发送隐私或保密材料。离线审查不需要同意。',consent:'我明确同意本次点击AI按钮时发送上述材料。',review:'开始验收 →',verdictRule:'任何必需项失败 → 需要修改；缺少证据 → 不能证实；不会用平均分掩盖关键问题。',reportTitle:'看目的是否有证据支持',emptyTitle:'“完成了”不是验收结论。',emptyBody:'从左侧选择示例或放入文件，再开始验收。每项结论都会保留对应依据、文件哈希与未解决的缺口。',resultsTitle:'逐项结论 · 证据链',inventory:'文件字节指纹与报告快照',downloadJson:'下载证据JSON ↓',downloadMd:'下载报告 ↓',explain:'用SERV解读这份报告 ↗',aiAdvisory:'AI解读仅是说明草稿，不能改变上面的证据结论。',limitsTitle:'通用审查框架，不等于已支持所有交付类型。',limitsBody:'当前可验证数据文件和离线静态网页的已声明条件。事实核查是与提供的依据对照，不是自动证明现实世界真伪；生产系统、任意程序、Office/PDF、付款与客户接收均不会被假装验证。',footer:'更少空泛保证，更多可追溯证据。',staticMode:'浏览器本机检查 · 无自动上传',liveMode:'本地服务已连接 · 可选实跑 / SERV',reference:'依据',deliverable:'交付',remove:'移除文件',required:'必需',advisory:'建议',noRules:'尚未定义验收条件。先生成起点，或用本地SERV拆解目的。',staticHint:'公开页实时检查文件，不是播放预存结论。AI规划和独立网页实跑需启动本地服务；这里不会冒充已调用模型。',liveHint:'已连接本机。展开“数据发送说明”并明确同意后，才能点击可选AI功能。',noKeyHint:'本地审查可用，未配置SERV密钥；AI按钮不会产生调用。',needApply:'精确规则已修改，请先点击“应用规则”。',busy:'正在核对文件与证据…',busyRuntime:'正在独立浏览器里实际执行验收步骤…',busyAI:'正在向SERV请求验收计划…',busyExplain:'正在请求AI解读，证据结论保持不变…',pass:'通过',fail:'失败',unverified:'未验证',not_checked:'未检查',not_applicable:'不适用',files:'文件',structure:'结构',facts:'事实',execution:'运行',purpose:'目的',needs_correction:'需要修改，当前不能验收',not_proven:'尚不能证实目的已实现',criteria_satisfied:'已声明的验收条件全部满足',failDetail:'必需条件中存在真实不一致。请按下方失败项修改，不能让其他通过项抵消它。',unknownDetail:'关键证据或目标覆盖尚未完整。没有观察到失败，不等于已经做到。',passDetail:'结论仅对应当前文件字节和已确认条件；不代表生产环境或范围外目的也已验证。',rawEvidence:'展开测量记录与执行步骤',newFiles:'已载入真实文件；请检查客户目的、文件角色与新验收条件。',emptyGoal:'请先填写客户目的。',snapshotLabel:'报告仅适用于这份目的、条件和字节快照：',planUnconfirmed:'SERV提出的验收计划已生成，请检查后确认范围。它不是已通过的证明。',apiUnavailable:'本地服务不可用；未执行任何网页流程。',noFiles:'请先选择文件。'},
 en:{legacy:'Original replay',source:'Source ↗',eyebrow:'GENERAL DELIVERY AUDIT · PURPOSE FIRST',hero:'Not just what was sent.<br><span>Did it do the job?</span>',lede:'Audit the delivered outcome, not just a website. Start with the customer purpose; inspect files, facts and behavior. Text, data and static-web checks are the first supported adapters.',principleLabel:'ONE RULE WE NEVER SKIP',principle:'No evidence. No pass.',principleBody:'AI proposes checks and explains findings. The actual files and execution evidence determine the verdict.',workspace:'Delivery acceptance workspace',trySample:'TRY A FRESHLY CHECKED EXAMPLE',synthetic:'SYNTHETIC FILES',custom:'＋ Review your own delivery',goalTitle:'Define the customer outcome',deliveryType:'Delivery type',dataType:'Data / report',webType:'Static web / user journey',generalType:'General delivery / custom audit',filesTitle:'Add the delivery and its sources',chooseFiles:'Choose files',chooseFolder:'Choose delivery folder',fileHint:'UTF-8 text, CSV, JSON and static web assets. Up to 40 files / 2 MiB. Files stay in this page’s memory.',roleHint:'Source = the customer’s reference material. Delivery = the result under review. A delivery alone cannot establish the underlying facts.',contractTitle:'Make the objective testable',starter:'Build an offline starting point',plan:'Plan checks with SERV ↗',editContract:'Inspect / edit exact acceptance rules',contractHint:'After editing, click Apply rules. Unsupported conditions stay unverified; AI cannot silently approve them.',applyContract:'Apply rules',scope:'These criteria cover this customer objective. The verdict is bounded by this explicit contract.',runtime:'Allow these journeys in a fresh, offline browser. Never use my logged-in session.',aiSettings:'Optional AI · data disclosure',aiDisclosure:'Planning sends SERV the objective, filenames, file roles, CSV headers and HTML control identifiers. Explanation sends derived evidence in the current report. Provider organization settings may allow data collection. Do not send private or confidential material. Offline checks require no consent.',consent:'I explicitly consent to sending this material when I click an AI button.',review:'Run acceptance checks →',verdictRule:'Any mandatory failure blocks acceptance. Missing evidence means not proven. No average score can hide a critical gap.',reportTitle:'Does the evidence support the goal?',emptyTitle:'“Done” is not an acceptance verdict.',emptyBody:'Select an example or supply files, then run the checks. Every finding keeps its evidence, byte hashes and unresolved gaps.',resultsTitle:'CRITERIA · EVIDENCE CHAIN',inventory:'File fingerprints and report snapshot',downloadJson:'Evidence JSON ↓',downloadMd:'Download report ↓',explain:'Explain this report with SERV ↗',aiAdvisory:'AI explanation is an advisory draft. It cannot change the evidence-based verdict above.',limitsTitle:'A general audit framework, not universal artifact support.',limitsBody:'This release checks declared conditions for data artifacts and offline static web journeys. Source agreement is not independent real-world fact verification. Production systems, arbitrary programs, Office/PDF, payments and customer receipt are not pretended to be verified.',footer:'Fewer empty assurances. More traceable evidence.',staticMode:'Local browser checks · no automatic uploads',liveMode:'Local service connected · runtime / SERV optional',reference:'Source',deliverable:'Delivery',remove:'Remove file',required:'Required',advisory:'Advisory',noRules:'No acceptance criteria yet. Build a starting point or use the local SERV planner.',staticHint:'This public page checks file bytes now, not saved verdicts. AI planning and isolated web journeys require the local service. No model call is implied.',liveHint:'Connected locally. Open the data disclosure and explicitly consent to enable optional AI features.',noKeyHint:'Local checks are available. SERV is not configured; AI buttons make no requests.',needApply:'Rules were edited. Click Apply rules before reviewing.',busy:'Checking files and evidence…',busyRuntime:'Executing actual acceptance steps in an isolated browser…',busyAI:'Requesting an acceptance plan from SERV…',busyExplain:'Requesting an AI explanation; the verdict stays fixed…',pass:'Passed',fail:'Failed',unverified:'Unverified',not_checked:'Not checked',not_applicable:'N/A',files:'Files',structure:'Structure',facts:'Facts',execution:'Runtime',purpose:'Purpose',needs_correction:'Correction required. Not acceptable yet.',not_proven:'The objective is not proven yet.',criteria_satisfied:'Declared acceptance criteria satisfied.',failDetail:'A mandatory condition has a demonstrated inconsistency. Fix the failed criteria below; other passes cannot cancel it out.',unknownDetail:'Critical evidence or goal coverage is incomplete. Not observing a failure is not proof of success.',passDetail:'Bounded to these file bytes and confirmed criteria. This is not a guarantee about production or out-of-scope outcomes.',rawEvidence:'Measured evidence and executed steps',newFiles:'Real files loaded. Review the objective, source roles and acceptance criteria.',emptyGoal:'Describe the customer objective first.',snapshotLabel:'This report is bound to this objective, contract and byte snapshot:',planUnconfirmed:'SERV proposed an acceptance plan. Review it and confirm the scope. It is not proof that the delivery passed.',apiUnavailable:'Local service unavailable. No browser journey was executed.',noFiles:'Choose files first.'}}
;
let lang;try{lang=localStorage.getItem('delivery-note-language');}catch{}if(!['zh','en'].includes(lang))lang=navigator.language.startsWith('zh')?'zh':'en';
let samples=[],pkg,selected=null,live=false,serv=false,remaining=0,busy=false,lastReport=null,editorDirty=false,planInfo='';
const t=k=>words[lang][k]||k;
const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
const bilingual=s=>{const parts=s.split(' / ');return parts.length===2?parts[lang==='zh'?1:0]:s;};
function notify(message){$('error').textContent=message;$('error').hidden=!message;}
function invalidate(resetScope=true){lastReport=null;$('report').hidden=true;$('empty').hidden=false;$('ai-note-wrap').hidden=true;if(resetScope&&pkg){pkg.scope_confirmed=false;$('scope').checked=false;}notify('');refreshControls();}
function refreshControls(){
 $('review').disabled=busy||!pkg?.files.length||!pkg?.objective.trim()||editorDirty;
 $('starter').disabled=busy||!pkg?.files.length||!pkg?.objective.trim();
 const aiAllowed=live&&serv&&remaining>0&&$('consent').checked&&!busy&&!editorDirty&&!!pkg?.files.length&&!!pkg?.objective.trim();
 $('plan').disabled=!aiAllowed;$('explain').disabled=!aiAllowed||!lastReport;
 $('download-json').disabled=busy||!lastReport;$('download-md').disabled=busy||!lastReport;
 $('runtime-row').hidden=pkg?.profile!=='web';$('runtime').disabled=!live||busy;
 $('mode').textContent=t(live?'liveMode':'staticMode');
 $('planner-info').textContent=planInfo||(live?t(serv?'liveHint':'noKeyHint'):t('staticHint'));
 $('review').textContent=busy?t('busy'):t('review');
}
function setBusy(value,label='busy'){
 busy=value;for(const e of document.querySelectorAll('button,input,select,textarea'))e.disabled=value;
 document.body.classList.toggle('loading',value);refreshControls();if(value)$('review').textContent=t(label);
}
function renderLanguage(){
 document.documentElement.lang=lang==='zh'?'zh-CN':'en';
 for(const e of document.querySelectorAll('[data-i18n]'))e.textContent=t(e.dataset.i18n);
 // The only innerHTML in this app uses fixed, audited translation literals, never uploaded data.
 for(const e of document.querySelectorAll('[data-i18n-html]'))e.innerHTML=t(e.dataset.i18nHtml);
 $('language').textContent=lang==='zh'?'EN':'中文';
 $('objective').placeholder=lang==='zh'?'客户最终要达到什么结果？有哪些不能违背的条件？':'What should the customer be able to achieve? What must remain true?';
 if(pkg){renderSamples();renderFiles();renderContract();if(lastReport)renderReport(lastReport);}refreshControls();
}
function renderSamples(){
 $('cases').replaceChildren();for(const s of samples){const b=node('button',undefined,'case'+(s.id===selected?' active':''));b.type='button';b.dataset.case=s.id;b.setAttribute('aria-pressed',String(s.id===selected));b.append(node('strong',s.title[lang]),node('span',s.caption[lang]));b.addEventListener('click',()=>loadSample(s.id));$('cases').append(b);}
 $('case-state').textContent=selected?t('synthetic'):(lang==='zh'?'本次文件':'YOUR FILES');
}
function renderFiles(){
 $('files').replaceChildren();for(const [i,f]of pkg.files.entries()){
  const row=node('div',undefined,'file'),mark=node('span',f.name.split('.').pop().toUpperCase().slice(0,5),'file-mark'),info=node('div',undefined,'file-info');
  info.append(node('span',f.name,'file-name'),node('span',`${fileBytes(f).length.toLocaleString()} bytes · UTF-8 / raw bytes`,'file-size'));
  const role=node('select');role.setAttribute('aria-label',f.name+' role');for(const value of ['reference','deliverable']){const o=node('option',t(value));o.value=value;role.append(o);}role.value=f.role;
  role.addEventListener('change',()=>{f.role=role.value;invalidate();});
  const remove=node('button','×','remove');remove.setAttribute('aria-label',t('remove')+' '+f.name);remove.addEventListener('click',()=>{pkg.files.splice(i,1);invalidate();renderFiles();});row.append(mark,info,role,remove);$('files').append(row);
 }
}
function renderContract(){
 $('requirements').replaceChildren();$('contract-count').textContent=String(pkg.requirements.length);
 if(!pkg.requirements.length)$('requirements').append(node('p',t('noRules'),'hint'));
 for(const r of pkg.requirements){const box=node('div',undefined,'requirement'),head=node('div',undefined,'requirement-head');head.append(node('span',r.id,'requirement-id'),node('span',bilingual(r.title),'requirement-title'));box.append(head,node('p',`${t(r.critical?'required':'advisory')} · L${layerOf(r.check.type)} · ${r.check.type} · ${r.check.file||r.check.entry||''}`,'requirement-meta'));$('requirements').append(box);}
 if(!editorDirty)$('contract-json').value=JSON.stringify(pkg.requirements,null,2);
}
function loadSample(id){
 const s=samples.find(s=>s.id===id);selected=id;pkg=structuredClone(s.package);if(lang==='en')pkg.objective=s.objective_en;
 $('objective').value=pkg.objective;$('profile').value=pkg.profile;$('scope').checked=pkg.scope_confirmed;$('runtime').checked=false;$('consent').checked=false;editorDirty=false;planInfo='';invalidate(false);renderSamples();renderFiles();renderContract();
}
function makeCustom(){selected=null;pkg={objective:'',profile:'general',scope_confirmed:false,requirements:[],files:[]};$('objective').value='';$('profile').value='general';$('runtime').checked=false;$('consent').checked=false;editorDirty=false;planInfo='';invalidate();renderSamples();renderFiles();renderContract();$('objective').focus();}
async function importFiles(list,folder=false){
 if(!list.length)return;let previous=pkg;setBusy(true);
 try{
  if(list.length>LIMITS.files||Array.from(list).reduce((n,f)=>n+f.size,0)>LIMITS.bytes)throw Error('Maximum: 40 files / 2 MiB');
  const additions=[];for(const f of list){const bytes=new Uint8Array(await f.arrayBuffer());let binary='';for(let start=0;start<bytes.length;start+=8192)binary+=String.fromCharCode(...bytes.subarray(start,start+8192));let name=folder?f.webkitRelativePath.split('/').slice(1).join('/'):f.name;additions.push({name,role:'deliverable',base64:btoa(binary)});}
  const files=selected?[]:[...pkg.files];for(const f of additions){const i=files.findIndex(x=>x.name===f.name);if(i>=0)files[i]=f;else files.push(f);}
  const candidate={...pkg,files,scope_confirmed:false,requirements:selected?[]:pkg.requirements};
  // Temporarily use a nonempty goal only to validate upload bounds; do not invent a customer goal.
  validatePackage({...candidate,objective:candidate.objective||'Pending customer objective'});
  pkg=candidate;selected=null;editorDirty=false;planInfo=t('newFiles');invalidate();renderSamples();renderFiles();renderContract();
 }catch(e){pkg=previous;notify(e.message);}finally{setBusy(false);$('file-picker').value='';$('folder-picker').value='';}
}
function observation(e){
 if(lang==='en')return e.observation;
 if(e.status==='unverified'){
  if(e.method==='browser_flow')return '还没有与当前文件和验收规则绑定的实际网页运行证据。';
  if(e.requirement_id==='SCOPE-confirm')return '验收计划还没有确认覆盖客户目的，不能据此宣布目标完成。';
  if(e.requirement_id==='SCOPE-general')return '当前交付用途超出已实现验证器的范围，需要补充专用检查或独立证据。';
  return '这一条件尚无足够证据支持。需要补充检查、事实依据或明确验收范围。';
 }
 if(e.status==='fail'){
  if(e.method==='csv_transform')return '交付内容与原始文件按声明规则重算的结果不一致；行数相同也不能通过。';
  if(e.method==='browser_flow')return '已实际操作网页，但观察到的结果没有满足这条客户要求。';
  if(e.method==='sum_matches_json')return '汇总数值与指定明细重新计算的结果不一致。';
  if(e.method==='csv_unique')return '唯一性检查失败，请查看具体重复记录或缺失列。';
  return '检查未通过。下面保留具体的实际值、预期值或解析错误。';
 }
 const messages={file_exists:'已读取实际文件字节并计算指纹，不是只检查自报文件清单。',sha256:'实际字节的SHA-256与预期指纹一致。',csv_columns:'从真实CSV文件解析出的必需列均存在。',csv_row_count:'实际解析的数据记录数符合要求，未把表头计作数据。',csv_unique:'逐条检查后，指定列的键值没有重复。',csv_not_empty:'逐条检查后，指定必需列没有空值。',csv_transform:'已从原始依据独立重算；交付文件的每行、每个单元格均符合声明规则。',sum_matches_json:'已精确重算明细合计，并与JSON中的汇总值对照一致。这证明材料间一致，不证明外部事实。',json_value:'实际读取的JSON值与验收条件中的预期值一致。',text_includes:'文件中存在指定文字；这不能证明文字所说的事实为真。',browser_flow:'已经在独立离线浏览器中完成实际操作，并验证了可观察的输出。'};
 return messages[e.method]||e.observation;
}
function renderReport(report){
 $('empty').hidden=true;$('report').hidden=false;
 const state=report.status==='criteria_satisfied'?'pass':report.status==='needs_correction'?'fail':'unverified';
 $('decision').className='decision '+state;$('decision').replaceChildren(node('strong',t(report.status)),node('p',t(state==='pass'?'passDetail':state==='fail'?'failDetail':'unknownDetail')));
 $('stats').replaceChildren();for(const [key,label]of [['passed','pass'],['failed','fail'],['unverified','unverified']]){const box=node('div',undefined,'stat');box.append(node('strong',String(report.summary[key])),node('span',t(label)+' · '+t('required')));$('stats').append(box);}
 $('layers').replaceChildren();const names=['files','structure','facts','execution','purpose'];for(const layer of report.layers){const box=node('div',undefined,'layer '+layer.status);box.title=layer.reason;box.append(node('small','0'+layer.level),node('strong',t(names[layer.level-1])),node('span',t(layer.status)));$('layers').append(box);}
 $('runtime-warning').hidden=!report.runtime_warning;$('runtime-warning').textContent=report.runtime_warning||'';
 $('results').replaceChildren();
 const ordered=[...report.results].sort((a,b)=>({fail:0,unverified:1,pass:2}[a.status]-{fail:0,unverified:1,pass:2}[b.status]));
 for(const r of ordered){
  const item=node('article',undefined,'result-item'),top=node('div',undefined,'result-top');top.append(node('span',r.id,'requirement-id'),node('h4',bilingual(r.title)),node('span',t(r.status),'status '+r.status));item.append(top);
  for(const id of r.evidence_ids){const e=report.evidence.find(x=>x.id===id);item.append(node('p',observation(e),'observation'),node('p',`${id} · ${e.method} · ${e.sources.map(x=>x.file).join(' ↔ ')||'—'}`,'evidence-source'));const d=node('details');d.append(node('summary',t('rawEvidence')),node('pre',JSON.stringify(e,null,2)));item.append(d);}
  $('results').append(item);
 }
 $('inventory').replaceChildren();for(const f of report.inventory)$('inventory').append(node('div',`${f.name} · ${t(f.role)} · ${f.bytes} bytes\nSHA-256 ${f.sha256}`,'inventory-entry'));
 $('snapshot').textContent=t('snapshotLabel')+'\n'+report.snapshot+'\n'+report.created_at;refreshControls();
}
async function api(path,body){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),75000);
 try{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Local service error');return data;}
 catch(e){if(e.name==='AbortError')throw Error('Request timed out; no new result has been accepted.');throw e;}finally{clearTimeout(timer);}
}
async function review(){
 notify('');if(editorDirty)return notify(t('needApply'));const captured=structuredClone(pkg);const execute=live&&$('runtime').checked&&pkg.profile==='web';invalidate(false);setBusy(true,execute?'busyRuntime':'busy');
 try{validatePackage(captured);lastReport=live?await api('/api/audit',{package:captured,execute_browser:execute,execution_consent:execute}):await audit(captured);renderReport(lastReport);}
 catch(e){notify(e.message);}finally{setBusy(false);}
}
async function starter(){
 setBusy(true);try{const inv=await inventory(pkg);const req=[];
  for(const f of inv.filter(f=>f.role==='deliverable').slice(0,7))req.push({id:'R'+(req.length+1),title:(lang==='zh'?'文件可读取：':'Readable file: ')+f.name,critical:true,check:{type:'file_exists',file:f.name}});
  req.push({id:'GOAL',title:lang==='zh'?'证明客户目的已实现':'Establish the customer outcome',critical:true,check:{type:'manual',reason:lang==='zh'?'仅检查文件存在不足以证明目的；需要定义具体的输入、操作、预期输出或依据对照。':'File presence is insufficient. Define the actual inputs, actions, expected outputs or source-based comparisons.'}});
  pkg.requirements=req;editorDirty=false;planInfo='';invalidate();renderContract();
 }catch(e){notify(e.message);}finally{setBusy(false);}
}
async function plan(){
 if(!$('consent').checked)return;setBusy(true,'busyAI');notify('');
 try{const result=await api('/api/plan',{package:pkg,consent:true,language:lang});validateRequirements(result.requirements);pkg.requirements=result.requirements;pkg.scope_confirmed=false;remaining=result.remaining_calls;editorDirty=false;invalidate();planInfo=t('planUnconfirmed')+' '+(result.assumptions||[]).join(' ');renderContract();}
 catch(e){notify(e.message);}finally{await refreshStatus();setBusy(false);}
}
async function explainReport(){
 if(!lastReport||!$('consent').checked)return;setBusy(true,'busyExplain');notify('');
 try{const result=await api('/api/explain',{package:pkg,consent:true,language:lang});remaining=result.remaining_calls;$('ai-note').textContent=result.note;$('ai-note-wrap').hidden=false;$('ai-provenance').textContent=`SERV · ${result.provenance.model} · ${result.provenance.recorded_at} · ${result.provenance.request_id||'no request id'}`;}
 catch(e){notify(e.message);}finally{await refreshStatus();setBusy(false);}
}
function download(kind){if(!lastReport)return;const text=kind==='json'?JSON.stringify(lastReport,null,2):markdown(lastReport);const url=URL.createObjectURL(new Blob([text],{type:kind==='json'?'application/json;charset=utf-8':'text/markdown;charset=utf-8'}));const a=node('a');a.href=url;a.download='delivery-review-'+lastReport.snapshot.slice(0,10)+'.'+kind;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
async function refreshStatus(){
 if(!['127.0.0.1','localhost'].includes(location.hostname))return;
 try{const response=await fetch('/api/status',{signal:AbortSignal.timeout(2500)});if(response.ok){const s=await response.json();live=s.mode==='live'&&s.node_available!==false;serv=!!s.serv_configured;remaining=s.remaining_calls||0;}}catch{live=false;serv=false;}
}
$('language').addEventListener('click',()=>{lang=lang==='zh'?'en':'zh';try{localStorage.setItem('delivery-note-language',lang);}catch{}renderLanguage();});
$('custom').addEventListener('click',makeCustom);
$('objective').addEventListener('input',()=>{pkg.objective=$('objective').value;invalidate();});
$('profile').addEventListener('change',()=>{pkg.profile=$('profile').value;$('runtime').checked=false;invalidate();});
$('scope').addEventListener('change',()=>{pkg.scope_confirmed=$('scope').checked;invalidate(false);});
$('consent').addEventListener('change',refreshControls);
$('runtime').addEventListener('change',()=>invalidate(false));
$('file-picker').addEventListener('change',e=>importFiles(e.target.files));
$('folder-picker').addEventListener('change',e=>importFiles(e.target.files,true));
$('contract-json').addEventListener('input',()=>{editorDirty=true;invalidate();});
$('apply-contract').addEventListener('click',()=>{try{const rules=JSON.parse($('contract-json').value);validateRequirements(rules);pkg.requirements=rules;editorDirty=false;invalidate();renderContract();}catch(e){notify(e.message);}});
$('starter').addEventListener('click',starter);$('plan').addEventListener('click',plan);$('review').addEventListener('click',review);$('explain').addEventListener('click',explainReport);
$('download-json').addEventListener('click',()=>download('json'));$('download-md').addEventListener('click',()=>download('md'));
try{const response=await fetch('cases.json');if(!response.ok)throw Error('Could not load example files');samples=(await response.json()).cases;await refreshStatus();loadSample(samples[0].id);renderLanguage();}catch(e){notify(e.message);$('review').disabled=true;}
