/* One evidence engine for the browser and local Node runner. No eval or network. */
export const VERSION = '0.2.0';
export const LIMITS = {files: 40, bytes: 2 * 1024 * 1024, requirements: 24, steps: 12};
export const TYPES = ['file_exists','sha256','csv_columns','csv_row_count','csv_unique',
  'csv_not_empty','csv_transform','sum_matches_json','json_value','text_includes','browser_flow','manual'];
const te = new TextEncoder();
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const error = msg => { throw new Error(msg); };
const assert = (ok,msg) => { if (!ok) error(msg); };
const str = (v,max=1000) => typeof v === 'string' && v.length > 0 && v.length <= max;
const strings = v => Array.isArray(v) && v.length > 0 && v.length <= 30 && v.every(x=>str(x,120)) && new Set(v).size===v.length;
export const layerOf = type => ({file_exists:1,sha256:1,csv_columns:2,csv_row_count:3,csv_unique:3,
  csv_not_empty:3,csv_transform:3,sum_matches_json:3,json_value:3,text_includes:2,browser_flow:4,manual:5}[type]||5);
export function canonical(value) {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (object(value)) return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export async function hash(bytes) {
  const c = globalThis.crypto || (await import('node:crypto')).webcrypto;
  return Array.from(new Uint8Array(await c.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
}
export function safeName(name) {
  return str(name,200) && !/[\\:\x00-\x1f?#%]/.test(name) && !name.startsWith('/') &&
    name.split('/').every(p=>p && p!=='.' && p!=='..' && !p.endsWith('.') && !p.endsWith(' '));
}
export function fileBytes(file) {
  if (typeof file.content === 'string') return te.encode(file.content);
  assert(typeof file.base64 === 'string' && file.base64.length<=Math.ceil(LIMITS.bytes/3)*4+4,'Invalid file encoding / 文件编码无效');
  assert(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64),'Invalid base64 / 无效字节编码');
  return Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0));
}
export function validateRequirements(requirements) {
  assert(Array.isArray(requirements)&&requirements.length<=LIMITS.requirements,'At most 24 requirements / 最多24条验收项');
  const ids=new Set();
  for (const r of requirements) {
    assert(object(r)&&/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(r.id||'')&&!ids.has(r.id),'Requirement IDs must be unique / 验收编号必须唯一');ids.add(r.id);
    assert(str(r.title,500)&&typeof r.critical==='boolean'&&object(r.check),'Invalid requirement / 验收项格式无效');
    const c=r.check;
    assert(TYPES.includes(c.type),'Unsupported check type / 不支持的检查类型: '+String(c.type));
    if (c.type!=='manual'&&c.type!=='browser_flow') assert(safeName(c.file),'A safe file path is required / 需要有效文件名');
    if (['csv_columns','csv_unique','csv_not_empty'].includes(c.type)) assert(strings(c.columns),'Specify unique column names / 需要不重复的列名');
    if (c.type==='sha256') assert(/^[0-9a-f]{64}$/i.test(c.expected||''),'Expected SHA-256 must have 64 hex digits');
    if (c.type==='csv_row_count') assert(Number.isSafeInteger(c.expected)&&c.expected>=0,'Row count must be a nonnegative integer');
    if (c.type==='text_includes') assert(str(c.value,4000),'A nonempty literal is required');
    if (c.type==='json_value'||c.type==='sum_matches_json') assert(typeof c.pointer==='string'&&c.pointer.length<=300&&(c.pointer===''||c.pointer.startsWith('/')),'Use an RFC6901 JSON pointer');
    if (c.type==='json_value') assert(own(c,'expected'),'An explicit expected JSON value is required');
    if (c.type==='csv_transform') assert(safeName(c.source)&&c.source!==c.file&&strings(c.keys),'Supply a distinct source and deduplication key columns');
    if (c.type==='sum_matches_json') assert(safeName(c.source)&&c.source!==c.file&&str(c.column,120),'Supply a CSV source and a numeric column');
    for(const key of ['trim','caseFold','unordered']) if(own(c,key)) assert(typeof c[key]==='boolean',`${key} must be boolean`);
    if(c.type==='browser_flow') {
      assert(safeName(c.entry)&&/\.html?$/i.test(c.entry),'Browser entry must be an uploaded HTML file');
      assert(Array.isArray(c.steps)&&c.steps.length>=2&&c.steps.length<=LIMITS.steps,'A flow needs 2–12 steps');
      let assertion=false, interaction=false;
      for(const s of c.steps) {
        assert(object(s)&&['fill','click','assert_text','assert_value','assert_count'].includes(s.action)&&str(s.selector,250),'Only bounded selector-based browser actions are supported');
        if(['fill','assert_text','assert_value'].includes(s.action)) assert(typeof s.value==='string'&&s.value.length<=1000,'Step value must be a bounded string');
        if(s.action==='assert_count') assert(Number.isSafeInteger(s.value)&&s.value>=0&&s.value<=1000,'Invalid element count');
        assertion ||= s.action.startsWith('assert_');interaction ||= ['fill','click'].includes(s.action);
      }
      assert(assertion&&interaction,'A flow must interact AND assert an observable outcome');
    }
  }
  return requirements;
}
export function validatePackage(pkg) {
  assert(object(pkg)&&str(pkg.objective,4000),'Describe the customer objective / 请描述客户目的');
  assert(['data','web','general'].includes(pkg.profile),'Choose a delivery type / 请选择交付类型');
  assert(typeof pkg.scope_confirmed==='boolean','Explicit scope confirmation is required');
  assert(Array.isArray(pkg.files)&&pkg.files.length>0&&pkg.files.length<=LIMITS.files,'Choose 1–40 files / 请选择1–40个文件');
  let bytes=0;const names=new Set();
  for (const f of pkg.files) {
    assert(object(f)&&safeName(f.name),'Unsafe file name / 文件名不安全');
    assert(!names.has(f.name.toLowerCase()),'Duplicate / case-colliding file paths / 文件名重复: '+f.name);names.add(f.name.toLowerCase());
    assert(['reference','deliverable'].includes(f.role),'Every file needs a source/deliverable role');
    assert((typeof f.content==='string') !== (typeof f.base64==='string'),'Supply exactly one content encoding');
    bytes += fileBytes(f).length;
  }
  assert(bytes<=LIMITS.bytes,'Total file limit is 2 MiB / 文件总量上限为2 MiB');
  assert(pkg.files.some(f=>f.role==='deliverable'),'At least one deliverable is required / 至少需要一个交付文件');
  validateRequirements(pkg.requirements);
  if (pkg.claims!==undefined) assert(Array.isArray(pkg.claims)&&pkg.claims.length<=10&&pkg.claims.every(c=>str(c,500)),'Invalid self-reported claims');
  return pkg;
}
/* Strict RFC4180-style CSV, including quoted newlines, escaped quotes, BOM, and CRLF. */
export function parseCSV(text) {
  text=text.replace(/^\uFEFF/,'');
  assert(text.length>0,'Empty CSV');
  const rows=[];let row=[],field='',quoted=false,closed=false,touched=false;
  const cell=()=>{row.push(field);field='';closed=false;};
  const line=()=>{cell();rows.push(row);row=[];touched=false;};
  for(let i=0;i<text.length;i++) {
    const c=text[i];touched=true;
    if(quoted) {
      if(c==='"') {if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
      else field+=c;
    } else if(c===',') cell();
    else if(c==='\n'||c==='\r') {if(c==='\r'&&text[i+1]==='\n')i++;line();}
    else if(c==='"') {assert(field===''&&!closed,'Unexpected quote in CSV');quoted=true;}
    else {assert(!closed,'Unexpected text after closing CSV quote');field+=c;}
  }
  assert(!quoted,'Unclosed CSV quote');
  if(touched||field||row.length)line();
  const columns=rows.shift();
  assert(columns&&columns.length>0&&columns.every(x=>x.length>0)&&new Set(columns).size===columns.length,'CSV headers must be nonempty and unique');
  assert(rows.length<=50000,'CSV row limit is 50,000');
  rows.forEach((r,i)=>assert(r.length===columns.length,`CSV record ${i+2}: ${r.length} fields, expected ${columns.length}`));
  return {columns,rows};
}
function pointer(doc,p) {
  let v=doc;
  if(!p)return v;
  for(const raw of p.slice(1).split('/')) {
    assert(!/~(?![01])/.test(raw),'Invalid JSON pointer escape');
    const key=raw.replace(/~1/g,'/').replace(/~0/g,'~');
    assert((object(v)||Array.isArray(v))&&own(v,key),'JSON pointer does not exist: '+p);v=v[key];
  }
  return v;
}
/* Exact fixed-point decimal arithmetic; avoid floating point sums masquerading as discrepancies. */
function decimal(v) {
  const s=String(v).trim();
  assert(/^[+-]?\d+(?:\.\d{1,6})?$/.test(s)&&s.length<=40,'Expected a decimal with at most 6 fraction digits');
  const sign=s[0]==='-'?-1n:1n;const [a,b='']=s.replace(/^[+-]/,'').split('.');
  return sign*(BigInt(a)*1000000n+BigInt(b.padEnd(6,'0')));
}
function printable(n) {const s=n<0n?'-':'';if(n<0n)n=-n;return s+String(n/1000000n)+(n%1000000n?'.'+String(n%1000000n).padStart(6,'0').replace(/0+$/,''):'');}
export async function inventory(pkg) {
  validatePackage(pkg);
  return Promise.all(pkg.files.map(async f=>{
    const bytes=fileBytes(f);let text=null,parse=null,problem=null;
    try {text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
    catch {problem='Not valid UTF-8 text; binary formats are not supported in this release.';}
    if(!problem) try {
      if(/\.csv$/i.test(f.name))parse=parseCSV(text);
      else if(/\.json$/i.test(f.name))parse=JSON.parse(text.replace(/^\uFEFF/,''));
    }catch(e){problem=e.message;}
    return {name:f.name,role:f.role,bytes:bytes.length,sha256:await hash(bytes),text,parsed:parse,problem};
  }));
}
export async function snapshot(pkg,files) {
  return hash(te.encode(canonical({objective:pkg.objective,profile:pkg.profile,scope_confirmed:pkg.scope_confirmed,
    requirements:pkg.requirements,claims:pkg.claims||[],files:files.map(f=>({name:f.name,role:f.role,sha256:f.sha256})).sort((a,b)=>a.name.localeCompare(b.name))})));
}
export async function audit(pkg,runtime={}) {
  const inv=await inventory(pkg);const digest=await snapshot(pkg,inv);const byName=new Map(inv.map(f=>[f.name,f]));
  const evidence=[],results=[];
  const add=(r,status,observation,sources=[],extra={})=>{
    const eid='E'+String(evidence.length+1).padStart(3,'0');
    const record={id:eid,requirement_id:r.id,layer:layerOf(r.check.type),method:r.check.type,status,observation,
      sources:sources.map(f=>({file:f.name,sha256:f.sha256,role:f.role})),...extra};evidence.push(record);
    results.push({id:r.id,title:r.title,critical:r.critical,layer:record.layer,status,evidence_ids:[eid]});
  };
  // Intrinsic failures cannot be hidden by omitting a requirement.
  for(const f of inv) if(f.problem||f.bytes===0) add({id:'FILE-'+(results.length+1),title:f.name,critical:true,check:{type:'file_exists'}},'fail',f.problem||'File is empty / 文件为空',[f],{layer:f.problem?2:1});
  const get=(name,format)=>{const f=byName.get(name);assert(f,'Missing uploaded file / 未上传文件: '+name);assert(!f.problem,f.problem);
    if(format==='csv')assert(/\.csv$/i.test(name)&&f.parsed?.columns,'Expected a parsed CSV file');
    if(format==='json')assert(/\.json$/i.test(name),'Expected a parsed JSON file');return f;};
  const columns=(f,names)=>names.map(c=>{const i=f.parsed.columns.indexOf(c);assert(i!==-1,`Missing column / 缺少列: ${c}`);return i;});
  for(const r of pkg.requirements) {
    const c=r.check;let sources=[];
    try {
      if(c.type==='manual'){add(r,'unverified',c.reason||'No independent evidence or supported executable check / 尚无独立证据或可执行检查');continue;}
      if(c.type==='browser_flow') {
        const files=inv.filter(f=>f.role==='deliverable');const receipt=runtime[r.id];
        if(!receipt||receipt.snapshot!==digest) {add(r,'unverified',receipt?'Stale execution evidence was rejected / 已拒绝过期运行证据':'No current isolated browser execution / 尚未实际运行网页流程',files,{next:'Run the local browser check; static inspection is not a substitute.'});continue;}
        assert(['pass','fail','unverified'].includes(receipt.status)&&receipt.runner==='isolated-browser-offline','Invalid runtime receipt');
        add(r,receipt.status,receipt.observation,files,{runner:receipt.runner,executed_at:receipt.executed_at,steps:receipt.steps||[],blocked_requests:receipt.blocked_requests||0});continue;
      }
      const f=get(c.file);sources=[f];
      if(c.type==='file_exists'){add(r,'pass',`Read ${f.bytes} bytes from the supplied file / 已读取实际文件字节`,sources);continue;}
      if(c.type==='sha256'){add(r,f.sha256===c.expected.toLowerCase()?'pass':'fail',`Actual SHA-256: ${f.sha256}; expected: ${c.expected}`,sources);continue;}
      if(c.type==='text_includes'){add(r,f.text.includes(c.value)?'pass':'fail','Literal text '+(f.text.includes(c.value)?'found':'not found')+'; this does not authenticate the statement itself / 只验证文字存在，不证明陈述真实',sources);continue;}
      if(c.type==='json_value'){const actual=pointer(get(c.file,'json').parsed,c.pointer);add(r,canonical(actual)===canonical(c.expected)?'pass':'fail',`JSON ${c.pointer||'/'}: actual ${JSON.stringify(actual).slice(0,500)}; expected ${JSON.stringify(c.expected).slice(0,500)}`,sources);continue;}
      if(c.type==='sum_matches_json') {
        const source=get(c.source,'csv');sources.push(source);
        const i=columns(source,[c.column])[0];assert(source.parsed.rows.length>0,'No source rows to sum');
        const sum=source.parsed.rows.reduce((s,row)=>s+decimal(row[i]),0n);
        const actual=pointer(get(c.file,'json').parsed,c.pointer);const expected=decimal(actual);
        add(r,sum===expected?'pass':'fail',`Source CSV sum (${c.column}, ${source.parsed.rows.length} records): ${printable(sum)}; delivered JSON ${c.pointer}: ${printable(expected)}. Source agreement, not external truth.`,sources);continue;
      }
      const csv=get(c.file,'csv');const {rows}=csv.parsed;
      if(c.type==='csv_columns'){columns(csv,c.columns);add(r,'pass',`Required columns found: ${c.columns.join(', ')}`,sources);continue;}
      if(c.type==='csv_row_count'){add(r,rows.length===c.expected?'pass':'fail',`Parsed data records (header excluded): ${rows.length}; expected: ${c.expected}`,sources);continue;}
      if(c.type==='csv_unique'||c.type==='csv_not_empty') {
        const indexes=columns(csv,c.columns);assert(rows.length>0,'Empty CSV cannot establish this delivery condition');
        const values=rows.map(row=>indexes.map(i=>{let v=row[i];if(c.trim)v=v.trim();if(c.caseFold)v=v.toLowerCase();return v;}));
        const bad=[];const seen=new Set();
        values.forEach((v,i)=>{const key=canonical(v);if(c.type==='csv_unique'?seen.has(key):v.some(x=>!x.trim()))bad.push(i+2);seen.add(key);});
        add(r,bad.length?'fail':'pass',bad.length?`${bad.length} violating CSV records; first record numbers: ${bad.slice(0,10).join(', ')} (header=1)`:`Checked ${rows.length} CSV records against ${c.type} on ${c.columns.join(', ')}`,sources);continue;
      }
      if(c.type==='csv_transform') {
        const source=get(c.source,'csv');sources.push(source);assert(source.role==='reference','Transformation input must be marked reference');
        assert(source.parsed.rows.length>0,'No source records supplied');assert(canonical(source.parsed.columns)===canonical(csv.parsed.columns),'Output columns differ from source (including order)');
        const indexes=columns(source,c.keys);const seen=new Set();const expected=[];
        for(const row of source.parsed.rows) {
          const normalized=row.map(v=>c.trim?v.trim():v);
          const key=canonical(indexes.map(i=>c.caseFold?normalized[i].toLowerCase():normalized[i]));
          if(!seen.has(key)){seen.add(key);expected.push(normalized);}
        }
        const expectedRows=expected.map(canonical),actualRows=rows.map(canonical);
        if(c.unordered){expectedRows.sort();actualRows.sort();}
        const match=canonical(expectedRows)===canonical(actualRows);
        const first=expectedRows.findIndex((v,i)=>actualRows[i]!==v);
        add(r,match?'pass':'fail',`Independently recomputed from ${source.parsed.rows.length} source records: expected ${expected.length}, delivered ${rows.length}. `+
          (match?'Every output cell matches the declared trim/deduplicate-first recipe.':`Content mismatch${first>=0?' at output record '+(first+2):''}; matching row counts alone are insufficient.`),sources,{recipe:{keys:c.keys,trim:!!c.trim,caseFold:!!c.caseFold,unordered:!!c.unordered}});continue;
      }
      add(r,'unverified','No supported evaluator for this criterion',sources);
    }catch(e){add(r,'fail',String(e.message).slice(0,800),sources);}
  }
  const gate=(id,title,reason)=>add({id,title,critical:true,check:{type:'manual'}},'unverified',reason);
  if(!pkg.requirements.length)gate('SCOPE-empty','Acceptance criteria / 验收标准','No criteria are defined; file parsing cannot prove the objective.');
  if(!pkg.scope_confirmed)gate('SCOPE-confirm','Confirm goal coverage / 确认目标覆盖','The proposed acceptance contract has not been confirmed to cover the customer objective.');
  if(pkg.profile==='general')gate('SCOPE-general','Unsupported purpose / 未覆盖的用途','This release cannot establish arbitrary business outcomes. Add independent evidence or a supported data/web contract.');
  if(pkg.profile==='data'&&!pkg.requirements.some(r=>r.critical&&['csv_transform','sum_matches_json','json_value','csv_unique','csv_not_empty','csv_row_count'].includes(r.check.type)))
    gate('SCOPE-data','Data outcome / 数据结果','No mandatory data/content outcome check; file existence alone is insufficient.');
  if(pkg.profile==='web'&&!pkg.requirements.some(r=>r.critical&&r.check.type==='browser_flow'))
    gate('SCOPE-web','Actual user journey / 实际用户流程','No mandatory browser journey with an observable assertion; source text cannot prove usability.');
  for(const [i,claim] of (pkg.claims||[]).entries())gate('CLAIM-'+(i+1),'Self-report / 自报陈述',claim+' — not independently authenticated.');
  const mandatory=results.filter(r=>r.critical),fails=mandatory.filter(r=>r.status==='fail'),unknown=mandatory.filter(r=>r.status==='unverified');
  const status=fails.length?'needs_correction':unknown.length?'not_proven':'criteria_satisfied';
  const layers=[1,2,3,4,5].map(level=>{
    const rs=results.filter(r=>r.layer===level);
    let state=rs.some(r=>r.status==='fail')?'fail':rs.some(r=>r.status==='unverified')?'unverified':rs.length?'pass':'not_checked';
    let reason='';
    if(level===1&&!rs.length){state='pass';reason=`Hashed ${inv.length} supplied files; integrity snapshot, not origin authentication.`;}
    if(level===2&&!rs.length&&inv.some(f=>/\.(json|csv)$/i.test(f.name))){state=inv.some(f=>f.problem)?'fail':'pass';reason='Parsed supplied CSV/JSON bytes.';}
    if(level===4&&pkg.profile==='data'&&!rs.length){state='not_applicable';reason='Declared scope is a data artifact, not a runnable application; generating code has not been executed.';}
    if(level===5){state=status==='criteria_satisfied'?'pass':status==='needs_correction'?'fail':'unverified';reason='Mandatory criteria + confirmed scope. No guarantee beyond this contract.';}
    return {level,status:state,reason,requirement_ids:rs.map(r=>r.id)};
  });
  return {schema_version:'delivery-note/2',engine_version:VERSION,created_at:new Date().toISOString(),snapshot:digest,
    objective:pkg.objective,profile:pkg.profile,scope_confirmed:pkg.scope_confirmed,status,
    summary:{mandatory:mandatory.length,passed:mandatory.filter(r=>r.status==='pass').length,failed:fails.length,unverified:unknown.length},
    inventory:inv.map(({name,role,bytes,sha256,problem})=>({name,role,bytes,sha256,problem})),
    contract:pkg.requirements,results,evidence,layers,
    next_actions:[...fails,...unknown].map(r=>({requirement_id:r.id,title:r.title,status:r.status,evidence_ids:r.evidence_ids})),
    limitations:['Conclusions apply only to these byte hashes, objective and declared acceptance criteria.',
      'Source agreement is not independent verification of real-world truth, customer acceptance, receipt or payment.',
      'No arbitrary code, authenticated website, production API, PDF or Office document verification is provided.',
      'Browser execution is an isolated offline sample journey, not a security certification or complete production test.']};
}
export function markdown(report) {
  const lines=['# Delivery Note — evidence report','',`**${report.status}**`, '', '## Customer objective', report.objective,'',
    `Created: ${report.created_at}`,`Engine: ${report.engine_version}`,`Snapshot: ${report.snapshot}`,'',
    `Mandatory criteria: ${report.summary.passed}/${report.summary.mandatory} passed; ${report.summary.failed} failed; ${report.summary.unverified} unverified.`,'',
    '## Results'];
  for(const r of report.results)lines.push(`\n### ${r.id} · ${r.status} · ${r.title}`,`Layer ${r.layer}; ${r.critical?'mandatory':'advisory'}; evidence: ${r.evidence_ids.join(', ')}`);
  lines.push('\n## Evidence');
  for(const e of report.evidence)lines.push(`\n### ${e.id} / ${e.requirement_id} / ${e.method}`,e.observation,...e.sources.map(s=>`- ${s.file} (${s.role}) SHA-256 ${s.sha256}`));
  lines.push('\n## File inventory',...report.inventory.map(f=>`- ${f.name} | ${f.role} | ${f.bytes} bytes | SHA-256 ${f.sha256}`),'\n## Limits',...report.limitations.map(s=>'- '+s));
  return lines.join('\n');
}
