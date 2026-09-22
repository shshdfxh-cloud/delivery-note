"""Visual and browser-interaction checks. Uses no model calls or existing user browser profile."""
import json, os, threading, re, argparse
from pathlib import Path
from http.server import HTTPServer
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'verification' / 'ui-refresh'

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--base-url');args=parser.parse_args()
    OUT.mkdir(exist_ok=True,parents=True)
    server=None
    if not args.base_url:
        os.environ.pop('SERV_API_KEY',None)
        import sys
        sys.path.insert(0,str(ROOT))
        from delivery_note.app import Handler
        server=HTTPServer(('127.0.0.1',0),Handler)
        server.remaining_calls=0;server.reports={};server.jobs={};server.agent_review=False
        threading.Thread(target=server.serve_forever,daemon=True).start()
        base=f'http://127.0.0.1:{server.server_port}/'
    else:base=args.base_url.rstrip('/')+'/'
    sample=json.loads((ROOT/'delivery_note/web/semantic-sample.json').read_text(encoding='utf-8'))
    response=json.loads((ROOT/'delivery_note/web/semantic-recording.json').read_text(encoding='utf-8'))['response']
    verified=[];errors=[];external_posts=[]
    def done(label):verified.append(label);print('PASS',label,flush=True)
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(channel='msedge',headless=True,chromium_sandbox=True)
            context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1,locale='zh-CN',accept_downloads=True,reduced_motion='reduce')
            page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('request',lambda r:external_posts.append(r.url) if r.method=='POST' and not r.url.startswith(base) else None)
            page.set_default_timeout(10000)
            page.goto(base,wait_until='networkidle',timeout=35000)
            assert page.locator('html').get_attribute('lang')=='en'
            assert 'But does it deliver?' in page.locator('h1').inner_text()
            assert page.locator('#prompt').is_hidden() and page.locator('#response').is_hidden()
            assert page.locator('#review-empty').is_visible()
            assert not page.evaluate("document.documentElement.scrollWidth>innerWidth")
            page.screenshot(path=str(OUT/'desktop-home.png'),full_page=False)
            done('English-first homepage; technical controls stay hidden until needed')
            page.locator('#language').click();assert page.locator('html').get_attribute('lang')=='zh-CN'
            assert page.locator('h1').inner_text().replace('\n','')=='交付了，真的做到了吗？'
            page.reload(wait_until='networkidle');assert page.locator('html').get_attribute('lang')=='zh-CN'
            page.locator('#language').click();assert page.locator('html').get_attribute('lang')=='en'
            done('Complete language switch persists across reload')
            page.locator('#replay').click();page.locator('#report').wait_for(state='visible')
            assert page.locator('.finding').count()==4
            assert 'Matched 10 records; expected 12' in page.locator('.machine-check>p').inner_text()
            assert page.locator('#decision strong').inner_text()=='Needs correction'
            assert page.locator('#objective').input_value()==sample['objective_en']
            assert page.locator('.report-stats .unverified strong').inner_text()=='1'
            assert 'no new model request was made' in page.locator('#recording-state').inner_text()
            page.evaluate("document.querySelector('#tab-report').scrollIntoView({block:'start',behavior:'instant'})");page.screenshot(path=str(OUT/'desktop-report.png'),full_page=False)
            page.locator('.output-card').screenshot(path=str(OUT/'report-card.png'))
            done('Recorded SERV result revalidated: 10 vs 12, four findings, one evidence gap')
            first=page.locator('.source-detail').first;first.locator('summary').click()
            assert first.locator('blockquote').inner_text()==response['requirements'][0]['evidence'][0]['quote']
            for text in page.locator('.finding h4,.finding-reason,.next-action').all_text_contents():assert not re.search('[\u4e00-\u9fff]',text),text
            assert page.locator('.source-detail blockquote').first.text_content()==response['requirements'][0]['evidence'][0]['quote']
            page.evaluate("document.querySelector('#tab-report').scrollIntoView({block:'start',behavior:'instant'})");page.screenshot(path=str(OUT/'english-report.png'),full_page=False)
            done('English sample objective and report are translated; verbatim Chinese evidence is unchanged')
            with page.expect_download() as download:page.locator('#download-md').click()
            md=download.value;md.save_as(str(OUT/'report-en.md'))
            assert '# Delivery review report' in (OUT/'report-en.md').read_text(encoding='utf-8')
            page.locator('#language').click();assert page.locator('html').get_attribute('lang')=='zh-CN'
            assert page.locator('#objective').input_value()==sample['objective']
            assert page.locator('#decision strong').inner_text()=='需要修改'
            with page.expect_download() as download:page.locator('#download-md').click()
            download.value.save_as(str(OUT/'report-zh.md'))
            assert '# 交付审查报告' in (OUT/'report-zh.md').read_text(encoding='utf-8')
            page.locator('#language').click();assert page.locator('html').get_attribute('lang')=='en'
            with page.expect_download() as download:page.locator('#download-json').click()
            download.value.save_as(str(OUT/'evidence.json'))
            report=json.loads((OUT/'evidence.json').read_text(encoding='utf-8'))
            assert report['verification']['quotes_match'] is True
            assert report['provenance']['serv_called_this_run'] is False
            assert report['results'][0]['evidence'][0]['quote']==response['requirements'][0]['evidence'][0]['quote']
            done('Actual downloads: Chinese and English Markdown plus unmodified evidence JSON')
            for width in [320,390,768,1024,1707]:
                page.set_viewport_size({'width':width,'height':844 if width<800 else 1000})
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'overflow {width}'
                if width==390:
                    page.locator('#replay').click();page.locator('#report').wait_for(state='visible');page.evaluate("document.querySelector('#tab-report').scrollIntoView({block:'start',behavior:'instant'})");page.screenshot(path=str(OUT/'mobile-report.png'),full_page=False)
                    page.evaluate("scrollTo({top:0,behavior:'instant'})");page.screenshot(path=str(OUT/'mobile-home.png'),full_page=False)
            done('No horizontal overflow at 320, 390, 768, 1024 and 1707 CSS pixels')
            page.set_viewport_size({'width':1440,'height':1000})
            page.locator('#language').click();assert page.locator('html').get_attribute('lang')=='zh-CN'
            page.locator('#reset').click()
            page.locator('#objective').fill(sample['objective'])
            files=[{'name':d['name'],'mimeType':'text/plain','buffer':d['content'].encode('utf-8')} for d in sample['documents']]
            page.locator('#files-input').set_input_files(files)
            expect(page.locator('.document-row')).to_have_count(3)
            for d in sample['documents']:page.get_by_role('combobox',name=d['name']+' 的材料角色',exact=True).select_option(d['role'])
            page.once('dialog',lambda dialog:dialog.dismiss());page.locator('#sample').click()
            assert page.locator('.document-row').count()==3
            page.locator('#build').click();assert '完整材料' in page.locator('#error').inner_text()
            page.locator('#consent').check();page.locator('#build').click()
            page.locator('#handoff').wait_for(state='visible');assert sample['objective'] in page.locator('#prompt').input_value()
            assert page.locator('#prompt').is_hidden()
            page.evaluate("document.querySelector('#tab-review').scrollIntoView({block:'start',behavior:'instant'})");page.screenshot(path=str(OUT/'desktop-handoff.png'),full_page=False)
            done('Real file picker, reference roles, replace confirmation, consent and package preparation')
            bad=json.loads(json.dumps(response));bad['requirements'][0]['evidence'][0]['quote']='fabricated quote'
            page.locator('#response').fill(json.dumps(bad,ensure_ascii=False));page.locator('#import').click()
            assert '引用与材料不一致' in page.locator('#error').inner_text();assert page.locator('#report').is_hidden()
            page.locator('#response').fill(json.dumps(response,ensure_ascii=False));page.locator('#import').click();page.locator('#report').wait_for(state='visible')
            assert page.locator('#decision strong').inner_text()=='需要修改'
            page.locator('#objective').fill(sample['objective']+'补充条件。')
            assert page.locator('#report').is_hidden() and page.locator('#download-md').is_disabled()
            assert page.locator('#report-empty').is_visible()
            done('Forged citation rejected; valid response imported; changed objective invalidates report and export')
            page.locator('#files-input').set_input_files({'name':'unsupported.pdf','mimeType':'application/pdf','buffer':b'%PDF-test'})
            assert 'UTF-8' in page.locator('#error').inner_text();assert page.locator('.document-row').count()==3
            done('Unsupported binary format rejected without losing existing files')
            page.evaluate("localStorage.removeItem('delivery-note-language-v2')")
            page.goto(base+'checks.html',wait_until='networkidle')
            assert page.locator('html').get_attribute('lang')=='en'
            page.locator('#review').click();page.locator('#report').wait_for(state='visible')
            assert 'Correction required' in page.locator('#decision').inner_text()
            page.screenshot(path=str(OUT/'checks-desktop.png'),full_page=False)
            page.set_viewport_size({'width':390,'height':844});assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
            page.screenshot(path=str(OUT/'checks-mobile.png'),full_page=False)
            assert page.get_by_role('link',name='General review',exact=True).is_visible()
            page.locator('#language').click();assert page.locator('html').get_attribute('lang')=='zh-CN'
            done('Companion checks page still runs real data checks and supports both languages on mobile')

            if not args.base_url:
                page.set_viewport_size({'width':1440,'height':1000})
                context.route('**/api/status',lambda route:route.fulfill(json={'mode':'live','node_available':True,'agent_review_available':True,'serv_configured':False,'remaining_calls':1}))
                queued={'posts':0,'polls':0}
                synthetic_result={'status':'complete','response':response,'report':report,'remaining_calls':0}
                def queue_handler(route):
                    payload=route.request.post_data_json
                    assert payload['objective']==sample['objective'] and payload['consent'] is True
                    queued['posts']+=1;route.fulfill(status=202,json={'status':'awaiting_agent','job_id':'ui-test-job','remaining_calls':0})
                def poll_handler(route):
                    queued['polls']+=1;route.fulfill(json={'status':'awaiting_agent'} if queued['polls']<2 else synthetic_result)
                context.route('**/api/general-review',queue_handler);context.route('**/api/agent-jobs/ui-test-job',poll_handler)
                page.goto(base,wait_until='networkidle')
                if page.locator('html').get_attribute('lang')=='en':page.locator('#language').click()
                page.locator('#sample').click();page.locator('#consent').check();page.locator('#build').click()
                page.locator('#live').wait_for(state='visible');page.locator('#live').click();page.locator('#report').wait_for(state='visible')
                assert queued['posts']==1 and queued['polls']==2
                assert '报告已返回' in page.locator('#packet-state').text_content()
                done('Local queue UI: one consented job, polling and result (test double; no SERV call)')
            assert not errors,errors;assert not external_posts,external_posts
            done('No JavaScript exceptions or provider POST requests')
            browser.close()
    finally:
        if server:server.shutdown();server.server_close()
        (OUT/('public-checks.json' if args.base_url else 'browser-checks.json')).write_text(json.dumps({'base':base,'checks':verified,'javascript_errors':errors,'external_posts':external_posts,'note':'Browser UI verification using recorded model material; no fresh SERV inference or credit spend.'},ensure_ascii=False,indent=2),encoding='utf-8')
    print('VERIFIED',len(verified),'SCENARIOS',flush=True)

if __name__=='__main__':main()
