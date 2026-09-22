"""Local live demo: python -m delivery_note.app. Public static demo replays saved runs."""
import argparse
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from .serv import generate

WEB = Path(__file__).parent / "web"
ASSETS = {"/": ("index.html", "text/html; charset=utf-8"),
          "/index.html": ("index.html", "text/html; charset=utf-8"),
          "/styles.css": ("styles.css", "text/css; charset=utf-8"),
          "/app.js": ("app.js", "text/javascript; charset=utf-8"),
          "/examples.json": ("examples.json", "application/json")}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def send(self, status, data, content_type="application/json"):
        content = json.dumps(data).encode() if isinstance(data, dict) else data
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(content)

    def allowed(self):
        host = self.headers.get("Host")
        expected = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
        return host in expected and self.headers.get("Origin", "http://" + host) == "http://" + host

    def do_GET(self):
        if not self.allowed():
            return self.send(403, {"error": "Local access only"})
        path = urlsplit(self.path).path
        if path == "/api/status":
            return self.send(200, {"mode": "live", "remaining_calls": self.server.remaining_calls})
        asset = ASSETS.get(path)
        if not asset:
            return self.send(404, {"error": "Not found"})
        try:
            return self.send(200, (WEB / asset[0]).read_bytes(), asset[1])
        except FileNotFoundError:
            return self.send(404, {"error": "Demo asset not built"})

    def do_POST(self):
        if not self.allowed():
            return self.send(403, {"error": "Local access only"})
        if self.path != "/api/review":
            return self.send(404, {"error": "Not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 256 or self.headers.get("Content-Type") != "application/json":
                raise ValueError()
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict) or set(data) != {"case_id"} or not isinstance(data["case_id"], str):
                raise ValueError()
            from .samples import examples
            if data["case_id"] not in examples():
                raise ValueError()
        except (ValueError, TypeError):
            return self.send(400, {"error": "Choose one of the three synthetic examples"})
        if self.server.remaining_calls <= 0:
            return self.send(429, {"error": "Demo call limit reached"})
        self.server.remaining_calls -= 1  # Failed requests consume a slot as well.
        try:
            result = generate(data["case_id"])
        except (RuntimeError, ValueError) as exc:
            return self.send(502, {"error": str(exc)})
        return self.send(200, result)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--max-calls", type=int, choices=range(1, 7), default=3)
    args = parser.parse_args()
    server = HTTPServer(("127.0.0.1", args.port), Handler)
    server.remaining_calls = args.max_calls
    print(f"Delivery Note: http://127.0.0.1:{args.port} — at most {args.max_calls} SERV requests", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
