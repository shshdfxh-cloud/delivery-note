/* Public site replays recorded SERV responses; the local server makes live calls. */
'use strict';
const el = id => document.getElementById(id);
const labels = {ready_for_human_review:'Ready for human review', needs_correction:'Correction required', needs_external_confirmation:'External confirmation needed'};
let data, selected = 'missing-row', live = false, busy = false, lastResult;

function select(id) {
  if (busy) return;
  selected = id;
  lastResult = null;
  const item = data.examples[id], p = item.packet, rows = p.rows;
  document.querySelectorAll('.case').forEach(b => {b.classList.toggle('active',b.dataset.id === id);b.setAttribute('aria-pressed',String(b.dataset.id === id));});
  el('case-title').textContent = item.title;
  el('case-caption').textContent = item.caption;
  const sum = rows.kept + rows.duplicates + rows.rejected;
  el('balance').textContent = `${sum} / ${rows.input}`;
  for (const [field,key] of [['input-count','input'],['kept-count','kept'],['duplicate-count','duplicates'],['rejected-count','rejected']]) el(field).textContent = rows[key];
  for (const key of ['kept','duplicates','rejected']) el(`${key}-bar`).style.width = `${rows[key]/rows.input*100}%`;
  el('gap-bar').style.width = `${Math.max(0, rows.input-sum)/rows.input*100}%`;
  el('tests').textContent = `${p.tests.passed} of ${p.tests.total} passed`;
  el('claim').textContent = p.claims.join(', ');
  el('packet-json').textContent = JSON.stringify(p,null,2);
  el('result-content').hidden = true;el('empty-result').hidden = false;el('error').hidden = true;
  el('review').disabled = false;
}

function display(result) {
  lastResult = result;
  el('empty-result').hidden = true;el('result-content').hidden = false;
  const r = result.review;
  el('verdict').textContent = labels[r.status] || r.status;
  el('verdict').className = 'verdict' + (r.status === 'ready_for_human_review' ? '' : ' issue');
  el('provenance').textContent = `${live ? 'Live' : 'Recorded'} SERV run · ${result.model} · ${new Date(result.recorded_at).toISOString().slice(0,16).replace('T',' ')} UTC · ${result.usage.total_tokens} tokens`;
  el('findings').replaceChildren();el('facts').replaceChildren();
  for (const f of r.findings) {
    const item = document.createElement('div');item.className = 'finding';
    const code = document.createElement('code');code.textContent = `[${f.id}]`;
    const p = document.createElement('p');p.textContent = f.message;
    item.append(code,p);el('findings').append(item);
  }
  for (const f of [...r.facts,...r.findings,{id:'scope',text:r.scope}]) {
    const item = document.createElement('div');item.className = 'fact';
    const code = document.createElement('code');code.textContent = `[${f.id}]`;
    const p = document.createElement('p');p.textContent = f.text || f.message;
    item.append(code,p);el('facts').append(item);
  }
  el('note').textContent = result.note;
}

el('review').addEventListener('click', async () => {
  busy = true;el('review').disabled = true;el('review').textContent = live ? 'Calling SERV…' : 'Opening recorded run…';el('error').hidden = true;
  try {
    let result;
    if (live) {
      const response = await fetch('api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({case_id:selected})});
      result = await response.json();
      if (!response.ok) throw new Error(result.error || 'SERV request failed');
    } else result = data.runs[selected];
    if (!result?.serv_called) throw new Error('A verified recorded run is unavailable.');
    display(result);
  } catch (e) {el('error').textContent = e.message;el('error').hidden = false;}
  finally {busy = false;el('review').disabled = false;el('review').textContent = live ? 'Review with SERV ↗' : 'Review sample ↗';}
});
el('download').addEventListener('click', () => {
  if (!lastResult) return;
  const blob = new Blob([JSON.stringify({mode:live?'live':'recorded',example:data.examples[selected],result:lastResult},null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob), a = document.createElement('a');a.href=url;a.download=`delivery-note-${selected}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});

(async () => {
  try {
    const response = await fetch('examples.json');
    if (!response.ok) throw Error('Could not load the synthetic examples.');
    data = await response.json();
    if (['127.0.0.1','localhost'].includes(location.hostname)) {
      try {const status=await fetch('api/status');live=status.ok&&(await status.json()).mode==='live';} catch (_) {}
    }
    Object.entries(data.examples).forEach(([id,item],i) => {
      const b=document.createElement('button');b.className='case';b.dataset.id=id;b.type='button';
      const n=document.createElement('span');n.className='case-number';n.textContent=`CASE 0${i+1}`;
      const title=document.createElement('strong');title.textContent=item.title;b.append(n,title);b.addEventListener('click',()=>select(id));el('cases').append(b);
    });
    el('mode').textContent = live ? 'LIVE · local server + SERV' : 'REPLAY · real SERV runs, saved';
    el('run-explanation').textContent = live ? 'Sends this synthetic review to SERV. At most 3 calls per default server session. No automatic retries.' : 'Replays a real, saved SERV response. This public demo makes no paid API calls. Run the local server for live inference.';
    select(selected);el('review').textContent=live?'Review with SERV ↗':'Review sample ↗';
  } catch(e) {el('mode').textContent='Demo could not load';el('error').textContent=e.message;el('error').hidden=false;}
})();
