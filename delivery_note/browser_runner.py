"""Bounded static-web journeys in a NEW offline browser, never the user's session.

This is not a container or a security certification. No shell/Python execution,
external network, credentials, filesystem URLs, persistent profiles or downloads.
"""
import base64
import json
import mimetypes
import os
import sys
import time
from datetime import datetime, timezone
from urllib.parse import unquote, urlsplit

ORIGIN = 'https://delivery.audit.invalid'
CSP = ("default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; "
       "img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; "
       "frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'self'")


def run(payload):
    from playwright.sync_api import sync_playwright, expect
    package, digest = payload['package'], payload['snapshot']
    flows = [r for r in package['requirements'] if r['check']['type'] == 'browser_flow']
    if len(flows) > 6:
        raise ValueError('At most six browser journeys per run')
    files = {f['name']: (f['content'].encode('utf-8') if 'content' in f else base64.b64decode(f['base64'], validate=True))
             for f in package['files'] if f['role'] == 'deliverable'}
    receipts = {}
    started = time.monotonic()
    clean_env = {k: v for k, v in os.environ.items() if k.upper() in {
        'PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'LOCALAPPDATA', 'USERPROFILE',
        'PROGRAMFILES', 'PROGRAMFILES(X86)', 'HOME', 'DISPLAY', 'XDG_RUNTIME_DIR'}}
    with sync_playwright() as p:
        options = dict(headless=True, chromium_sandbox=True, env=clean_env, timeout=15000,
                       args=['--disable-background-networking', '--disable-component-update',
                             '--disable-sync', '--disable-extensions', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'])
        # Installed system Edge on Windows; otherwise the documented Playwright Chromium.
        if sys.platform == 'win32':
            options['channel'] = 'msedge'
        browser = p.chromium.launch(**options)
        try:
            for r in flows:
                receipt = {'runner': 'isolated-browser-offline', 'snapshot': digest,
                           'executed_at': datetime.now(timezone.utc).isoformat(), 'steps': [], 'blocked_requests': 0}
                receipts[r['id']] = receipt
                context = browser.new_context(service_workers='block', accept_downloads=False,
                                              viewport={'width': 1100, 'height': 750}, permissions=[])
                context.set_default_timeout(1600)
                errors, missing = [], []
                requests = [0]

                def route(request_route):
                    request = request_route.request
                    target = urlsplit(request.url)
                    requests[0] += 1
                    if requests[0] > 300 or target.scheme != 'https' or target.netloc != 'delivery.audit.invalid' or request.method != 'GET':
                        receipt['blocked_requests'] += 1
                        request_route.abort()
                        return
                    name = unquote(target.path).lstrip('/')
                    if name not in files:
                        missing.append(name[:200])
                        request_route.fulfill(status=404, content_type='text/plain', body='Not in the uploaded delivery')
                        return
                    mime = mimetypes.guess_type(name)[0] or 'application/octet-stream'
                    if name.endswith(('.js', '.mjs')):
                        mime = 'text/javascript'
                    request_route.fulfill(status=200, body=files[name], content_type=mime,
                                          headers={'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff',
                                                   'Cache-Control': 'no-store'})

                context.route('**/*', route)
                # Refuse a runtime missing the WebSocket control instead of silently weakening isolation.
                if not hasattr(context, 'route_web_socket'):
                    context.close()
                    raise RuntimeError('Playwright 1.48+ is required for offline WebSocket blocking')
                context.route_web_socket('**/*', lambda ws: ws.close())
                page = context.new_page()
                page.on('pageerror', lambda e: errors.append(str(e)[:300]))
                def on_console(message):
                    if message.type == 'error':
                        text = message.text
                        if 'content security policy' in text.lower() or 'violates' in text.lower():
                            receipt['blocked_requests'] += 1
                        else:
                            errors.append(text[:300])
                page.on('console', on_console)
                page.on('dialog', lambda d: d.dismiss())
                page.on('popup', lambda popup: popup.close())
                try:
                    assert r['check']['entry'] in files, 'Uploaded HTML entry is missing'
                    page.goto(ORIGIN + '/' + r['check']['entry'], wait_until='load', timeout=5000)
                    for number, step in enumerate(r['check']['steps'], 1):
                        if time.monotonic() - started > 30:
                            raise TimeoutError('Whole browser review time budget exhausted')
                        target = page.locator(step['selector'])
                        action = step['action']
                        if action == 'fill':
                            target.fill(step['value'])
                        elif action == 'click':
                            target.click(no_wait_after=True)
                        elif action == 'assert_text':
                            expect(target).to_have_text(step['value'], timeout=1600)
                        elif action == 'assert_value':
                            expect(target).to_have_value(step['value'], timeout=1600)
                        elif action == 'assert_count':
                            expect(target).to_have_count(step['value'], timeout=1600)
                        else:
                            raise ValueError('Unsupported action')
                        receipt['steps'].append({'step': number, 'action': action, 'selector': step['selector'], 'status': 'pass'})
                    if missing or errors:
                        receipt.update(status='fail', observation='Journey has missing resources or JavaScript errors: ' + '; '.join((missing + errors)[:4]))
                    elif receipt['blocked_requests']:
                        receipt.update(status='unverified', observation='Assertions matched, but external/backend requests were blocked; production behavior is not established.')
                    else:
                        receipt.update(status='pass', observation=f"Executed {len(receipt['steps'])} actual browser steps including outcome assertions. Fresh profile, uploaded assets only, no outside network.")
                except Exception as exc:
                    receipt['steps'].append({'step': len(receipt['steps']) + 1, 'status': 'fail'})
                    detail = str(exc).split('Call log:')[0].strip()[:900]
                    receipt.update(status='unverified' if isinstance(exc, TimeoutError) or receipt['blocked_requests'] else 'fail',
                                   observation='Browser journey did not establish the required outcome: ' + detail)
                finally:
                    context.close()
        finally:
            browser.close()
    return receipts


def main():
    try:
        raw = sys.stdin.read(4 * 1024 * 1024 + 1)
        if len(raw) > 4 * 1024 * 1024:
            raise ValueError('Request too large')
        result = run(json.loads(raw))
        sys.stdout.write(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        # Do not dump provider keys, file contents or browser environment on failure.
        sys.stderr.write(type(exc).__name__ + ': isolated browser unavailable or run failed; no execution verdict was produced.')
        raise SystemExit(1)


if __name__ == '__main__':
    main()
