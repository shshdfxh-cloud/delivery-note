"""Goal-driven local review. Python 3.10+, Node 20+; Playwright optional for web journeys."""
import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from .serv import generate
from .goal_serv import propose, explain, call_serv

ROOT = Path(__file__).resolve().parent
WEB = ROOT / 'web'
ASSETS = {
    "/checks.html": ("checks.html", "text/html; charset=utf-8"),
    '/general-engine.mjs': ('general-engine.mjs', 'text/javascript; charset=utf-8'),
    '/semantic-recording.json': ('semantic-recording.json', 'application/json'),
    '/general-review.html': ('general-review.html', 'text/html; charset=utf-8'),
    '/general-review.mjs': ('general-review.mjs', 'text/javascript; charset=utf-8'),
    '/general-review.css': ('general-review.css', 'text/css; charset=utf-8'),
    '/semantic.mjs': ('semantic.mjs', 'text/javascript; charset=utf-8'),
    '/semantic-sample.json': ('semantic-sample.json', 'application/json'),
    '/': ('index.html', 'text/html; charset=utf-8'),
    '/index.html': ('index.html', 'text/html; charset=utf-8'),
    '/styles.css': ('styles.css', 'text/css; charset=utf-8'),
    '/app.mjs': ('app.mjs', 'text/javascript; charset=utf-8'),
    '/core.mjs': ('core.mjs', 'text/javascript; charset=utf-8'),
    '/cases.json': ('cases.json', 'application/json'),
    '/legacy/': ('legacy/index.html', 'text/html; charset=utf-8'),
    '/legacy/index.html': ('legacy/index.html', 'text/html; charset=utf-8'),
    '/legacy/app.js': ('legacy/app.js', 'text/javascript; charset=utf-8'),
    '/legacy/styles.css': ('legacy/styles.css', 'text/css; charset=utf-8'),
    '/legacy/examples.json': ('legacy/examples.json', 'application/json'),
    '/examples.json': ('legacy/examples.json', 'application/json'),
}
MAX_BODY = 3 * 1024 * 1024


def engine(package=None, runtime=None, mode='audit', requirements=None):
    node = shutil.which('node')
    if not node:
        raise RuntimeError('Node.js 20+ is required for the local service; the static browser checker still works')
    body = {'package': package, 'runtime': runtime or {}, 'mode': mode, 'requirements': requirements}
    try:
        proc = subprocess.run([node, str(ROOT / 'audit_cli.mjs')], input=json.dumps(body, ensure_ascii=False),
                              capture_output=True, text=True, encoding='utf-8', timeout=12, cwd=ROOT)
    except subprocess.TimeoutExpired:
        raise RuntimeError('Evidence checker timed out; no result was accepted') from None
    if proc.returncode:
        raise ValueError(proc.stderr[:1000] or 'Invalid review package')
    return json.loads(proc.stdout)


def run_browser(package, digest):
    clean_env = {k: v for k, v in os.environ.items() if k.upper() in {
        'PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'LOCALAPPDATA', 'USERPROFILE',
        'PROGRAMFILES', 'PROGRAMFILES(X86)', 'HOME', 'DISPLAY', 'XDG_RUNTIME_DIR'}}
    clean_env['PYTHONIOENCODING'] = 'utf-8'
    options = {'start_new_session': True} if os.name != 'nt' else {}
    proc = subprocess.Popen([sys.executable, '-m', 'delivery_note.browser_runner'], cwd=ROOT.parent,
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            text=True, encoding='utf-8', env=clean_env, **options)
    try:
        out, err = proc.communicate(json.dumps({'package': package, 'snapshot': digest}, ensure_ascii=False), timeout=45)
    except subprocess.TimeoutExpired:
        if os.name == 'nt':
            subprocess.run(['taskkill', '/PID', str(proc.pid), '/T', '/F'], capture_output=True, timeout=5)
        else:
            os.killpg(proc.pid, signal.SIGKILL)
        proc.communicate(timeout=5)
        raise RuntimeError('Isolated browser exceeded its time budget; execution remains unverified') from None
    if proc.returncode:
        raise RuntimeError(err[:300] or 'Isolated browser unavailable; execution remains unverified')
    return json.loads(out)


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(8)

    def log_message(self, *_):
        pass

    def send(self, status, data, content_type='application/json'):
        content = json.dumps(data, ensure_ascii=False).encode('utf-8') if isinstance(data, dict) else data
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.end_headers()
        try:
            self.wfile.write(content)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def allowed(self):
        host = self.headers.get('Host', '')
        expected = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        return host in expected and self.headers.get('Origin', 'http://' + host) == 'http://' + host

    def do_GET(self):
        if not self.allowed():
            return self.send(403, {'error': 'Local access only'})
        path = urlsplit(self.path).path
        if path == '/api/status':
            return self.send(200, {'mode': 'live', 'version': '0.3.0', 'remaining_calls': self.server.remaining_calls,
                                  'serv_configured': bool(os.environ.get('SERV_API_KEY')), 'agent_review_available': bool(getattr(self.server, 'agent_review', False)), 'node_available': bool(shutil.which('node'))})
        if path == '/api/agent-jobs':
            if not getattr(self.server, 'agent_review', False):
                return self.send(404, {'error': 'Agent review not enabled'})
            return self.send(200, {'jobs': [{'id': ident, 'status': job['status'],
                'system': job['prepared']['system'], 'prompt': job['prepared']['prompt'],
                'packet_id': job['prepared']['packet']['packet_id']}
                for ident, job in getattr(self.server, 'jobs', {}).items() if job['status'] == 'awaiting_agent']})
        if path.startswith('/api/agent-jobs/'):
            job = getattr(self.server, 'jobs', {}).get(path.rsplit('/', 1)[-1])
            if not job:
                return self.send(404, {'error': 'Unknown or expired review job'})
            return self.send(200, job.get('result') or {'status': job['status']})
        asset = ASSETS.get(path)
        if not asset:
            return self.send(404, {'error': 'Not found'})
        try:
            return self.send(200, (WEB / asset[0]).read_bytes(), asset[1])
        except FileNotFoundError:
            return self.send(404, {'error': 'Asset not found'})

    def do_POST(self):
        if not self.allowed():
            return self.send(403, {'error': 'Local access only'})
        if self.path not in {'/api/review', '/api/audit', '/api/plan', '/api/explain', '/api/general-review'} and not self.path.startswith('/api/agent-jobs/'):
            return self.send(404, {'error': 'Not found'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            cap = 256 if self.path == '/api/review' else MAX_BODY
            if not 0 < length <= cap or self.headers.get('Content-Type') != 'application/json':
                raise ValueError('Invalid JSON content type or body length')
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('JSON object required')
        except (ValueError, TypeError, TimeoutError):
            return self.send(400, {'error': 'Invalid or oversized JSON request'})
        if self.path.startswith('/api/agent-jobs/'):
            return self.agent_result(data)
        if self.path == '/api/review':
            return self.legacy(data)
        if self.path == '/api/general-review':
            return self.general_review(data)
        try:
            package = data.get('package')
            baseline = engine(package)
            if self.path == '/api/audit':
                report = baseline
                if data.get('execute_browser') is True:
                    if data.get('execution_consent') is not True:
                        return self.send(400, {'error': 'Explicit isolated browser execution consent is required'})
                    if any(r['check']['type'] == 'browser_flow' for r in package['requirements']):
                        try:
                            report = engine(package, run_browser(package, baseline['snapshot']))
                        except RuntimeError as exc:
                            report['runtime_warning'] = str(exc)
                cache = getattr(self.server, 'reports', {})
                cache[report['snapshot']] = report
                while len(cache) > 4:
                    del cache[next(iter(cache))]
                self.server.reports = cache
                return self.send(200, report)
            if data.get('consent') is not True:
                return self.send(400, {'error': 'Explicit consent to send selected material to SERV is required'})
            if not os.environ.get('SERV_API_KEY'):
                return self.send(503, {'error': 'SERV key not configured. Offline review does not require one.'})
            if self.server.remaining_calls <= 0:
                return self.send(429, {'error': 'Session SERV call limit reached'})
            language = 'zh' if data.get('language') == 'zh' else 'en'
            self.server.remaining_calls -= 1  # Includes failures; no hidden retries.
            if self.path == '/api/plan':
                inv = engine(package, mode='inventory')
                result = propose(package, inv['files'], language)
                engine(mode='validate-plan', requirements=result['requirements'])
            else:
                report = getattr(self.server, 'reports', {}).get(baseline['snapshot'], baseline)
                result = explain(report, language)
            result['remaining_calls'] = self.server.remaining_calls
            return self.send(200, result)
        except ValueError as exc:
            return self.send(400, {'error': str(exc)[:1000]})
        except (RuntimeError, OSError, json.JSONDecodeError) as exc:
            return self.send(502, {'error': str(exc)[:1000]})

    def general_review(self, data):
        """One opt-in goal/material/model/tools/report pipeline; no private-key extraction."""
        required = {'objective', 'documents', 'consent'}
        if not required.issubset(data) or set(data) - required - {'execute_browser', 'execution_consent'} or data.get('consent') is not True:
            return self.send(400, {'error': 'Explicit full-material consent and objective/documents are required'})
        if data.get('execute_browser') is True and data.get('execution_consent') is not True:
            return self.send(400, {'error': 'Explicit isolated execution consent is required'})
        def process(body):
            node = shutil.which('node')
            if not node:
                raise RuntimeError('Node.js is required')
            out = subprocess.run([node, str(ROOT / 'general_cli.mjs')],
                input=json.dumps(body, ensure_ascii=False), capture_output=True,
                text=True, encoding='utf-8', timeout=12, cwd=ROOT.parent)
            if out.returncode:
                raise ValueError(out.stderr[:1000])
            return json.loads(out.stdout)
        try:
            payload = {'objective': data['objective'], 'documents': data['documents']}
            prepared = process({**payload, 'mode': 'prepare'})
            agent_mode = getattr(self.server, 'agent_review', False)
            if not agent_mode and not os.environ.get('SERV_API_KEY'):
                return self.send(503, {'error': 'Start with --agent-review and use the existing AI assistant/browser tools, or use the portable review package. No key is needed for the agent route.'})
            if self.server.remaining_calls <= 0:
                return self.send(429, {'error': 'Session SERV call limit reached; no automatic retry'})
            self.server.remaining_calls -= 1
            if agent_mode:
                ident = uuid.uuid4().hex
                jobs = getattr(self.server, 'jobs', {})
                if len(jobs) >= 4:
                    return self.send(429, {'error': 'Agent job capacity reached; restart only after saving results'})
                jobs[ident] = {'status': 'awaiting_agent', 'prepared': prepared, 'payload': payload,
                    'execute_browser': data.get('execute_browser') is True, 'result': None}
                self.server.jobs = jobs
                return self.send(202, {'status': 'awaiting_agent', 'job_id': ident,
                    'remaining_calls': self.server.remaining_calls})
            raw, provenance = call_serv(prepared['system'], {'review_request': prepared['prompt']}, tokens=6000)
            checked = process({**payload, 'raw': raw})
            pkg = checked['package']
            if data.get('execute_browser') is True and any(r['check']['type'] == 'browser_flow' for r in pkg['requirements']):
                try:
                    runtime = run_browser(pkg, checked['report']['measured']['snapshot'])
                    checked = process({**payload, 'raw': raw, 'runtime': runtime})
                except RuntimeError as exc:
                    checked['report']['runtime_warning'] = str(exc)
            checked['report']['provenance'] = {**checked['report']['provenance'], **provenance}
            return self.send(200, {'response': raw, 'report': checked['report'], 'provenance': provenance,
                                   'remaining_calls': self.server.remaining_calls})
        except ValueError as exc:
            return self.send(400, {'error': str(exc)[:1000]})
        except (RuntimeError, OSError, subprocess.TimeoutExpired) as exc:
            return self.send(502, {'error': str(exc)[:1000]})

    def agent_result(self, data):
        ident = self.path.rsplit('/', 1)[-1]
        job = getattr(self.server, 'jobs', {}).get(ident)
        if not getattr(self.server, 'agent_review', False) or not job:
            return self.send(404, {'error': 'Unknown review job'})
        if job['status'] != 'awaiting_agent':
            return self.send(409, {'error': 'This job already has a result; never overwrite it'})
        if set(data) != {'response'}:
            return self.send(400, {'error': 'Only the complete model response is accepted'})
        try:
            def run(runtime=None):
                body = {**job['payload'], 'raw': data['response'], 'runtime': runtime or {}}
                out = subprocess.run([shutil.which('node') or 'node', str(ROOT / 'general_cli.mjs')],
                    input=json.dumps(body, ensure_ascii=False), capture_output=True, text=True,
                    encoding='utf-8', timeout=12, cwd=ROOT.parent)
                if out.returncode:
                    raise ValueError(out.stderr[:1000])
                return json.loads(out.stdout)
            checked = run()
            if job['execute_browser'] and any(r['check']['type'] == 'browser_flow' for r in checked['package']['requirements']):
                try:
                    runtime = run_browser(checked['package'], checked['report']['measured']['snapshot'])
                    checked = run(runtime)
                except RuntimeError as exc:
                    checked['report']['runtime_warning'] = str(exc)
            checked['report']['provenance'].update({'mode': 'connected-agent-browser-return',
                'provider_label': 'Returned by the connected AI assistant; no API attestation',
                'provider_authenticated': False, 'live_api_verified': False})
            result = {'response': checked['raw'], 'report': checked['report'],
                'provenance': checked['report']['provenance'], 'remaining_calls': self.server.remaining_calls,
                'status': 'complete'}
            job['status'] = 'complete'
            job['result'] = result
            return self.send(200, result)
        except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired) as exc:
            return self.send(400, {'error': str(exc)[:1000]})

    def legacy(self, data):
        from .samples import examples
        if set(data) != {'case_id'} or not isinstance(data['case_id'], str) or data['case_id'] not in examples():
            return self.send(400, {'error': 'Choose one of the three synthetic examples'})
        if self.server.remaining_calls <= 0:
            return self.send(429, {'error': 'Demo call limit reached'})
        self.server.remaining_calls -= 1
        try:
            return self.send(200, generate(data['case_id']))
        except (RuntimeError, ValueError) as exc:
            return self.send(502, {'error': str(exc)})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8766)
    parser.add_argument('--max-calls', type=int, choices=range(0, 7), default=3)
    parser.add_argument('--key-file', type=Path, help='Optional local secret file; never copied to browser or repository')
    parser.add_argument('--agent-review', action='store_true', help='Queue opt-in review jobs for an existing authorized AI assistant with browser tools; no keys.')
    args = parser.parse_args()
    if args.key_file:
        os.environ['SERV_API_KEY'] = args.key_file.read_text(encoding='utf-8').strip()
    server = HTTPServer(('127.0.0.1', args.port), Handler)
    server.agent_review = args.agent_review
    server.jobs = {}
    server.remaining_calls = args.max_calls
    server.reports = {}
    print(f'Delivery Note: http://127.0.0.1:{args.port} | {args.max_calls} maximum SERV attempts | offline by default', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
