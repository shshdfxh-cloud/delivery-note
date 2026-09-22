"""Goal-driven local review. Python 3.10+, Node 20+; Playwright optional for web journeys."""
import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from .serv import generate
from .goal_serv import propose, explain

ROOT = Path(__file__).resolve().parent
WEB = ROOT / 'web'
ASSETS = {
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
            return self.send(200, {'mode': 'live', 'version': '0.2.0', 'remaining_calls': self.server.remaining_calls,
                                  'serv_configured': bool(os.environ.get('SERV_API_KEY')), 'node_available': bool(shutil.which('node'))})
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
        if self.path not in {'/api/review', '/api/audit', '/api/plan', '/api/explain'}:
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
        if self.path == '/api/review':
            return self.legacy(data)
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
    args = parser.parse_args()
    if args.key_file:
        os.environ['SERV_API_KEY'] = args.key_file.read_text(encoding='utf-8').strip()
    server = HTTPServer(('127.0.0.1', args.port), Handler)
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
