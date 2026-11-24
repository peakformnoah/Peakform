from __future__ import annotations

import argparse
import http.client
import http.server
import os
import re
import socket
import sys
import webbrowser
from pathlib import Path
from urllib.parse import unquote, urlsplit


PUBLIC_ROOT_FILES = frozenset({
    "index.html", "about.html", "programs.html", "system.html", "space.html",
    "sources.html", "contact.html", "styles.css", "script.js", "content-config.js",
    "robots.txt", "sitemap.xml", "legacy-archive.js",
})
PUBLIC_ADMIN_FILES = frozenset({"index.html", "admin.js", "admin-config.js"})
PUBLIC_ASSETS = frozenset({"logo.png", "mark.png", "wordmark.png", "training.jpg"})


def is_public_file(parts: tuple[str, ...]) -> bool:
    if not parts or any(
        not part or part.startswith(".") or part.endswith((".", " "))
        or any(char in part for char in ("\\", ":", "%"))
        or any(ord(char) < 32 or ord(char) == 127 for char in part)
        for part in parts
    ):
        return False
    if len(parts) == 1:
        return parts[0] in PUBLIC_ROOT_FILES
    if parts[0] == "content":
        return len(parts) == 2 and parts[1] in ("posts.json", "release.json", "site.json", "legacy-albums.json")
    if parts[0] == "news":
        return len(parts) == 2 and (parts[1] == "index.html" or len(parts[1]) == 37 and parts[1].endswith(".html") and all(c in "0123456789abcdef" for c in parts[1][:-5]))
    if parts[0] == "admin":
        return len(parts) == 2 and parts[1] in PUBLIC_ADMIN_FILES
    if len(parts) == 2 and parts[0] == "assets":
        return parts[1] in PUBLIC_ASSETS
    if len(parts) == 3 and parts[:2] == ("assets", "journal"):
        return re.fullmatch(r"[a-f0-9]{32}(?:\.jpg|\.mp4|-poster\.jpg)", parts[2]) is not None
    return False


def detect_local_ip() -> str:
    """Best-effort LAN IP detection so phones on the same Wi-Fi can connect."""
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("8.8.8.8", 80))
        return probe.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


def build_handler(directory: Path, cms_port: int | None = None) -> type[http.server.SimpleHTTPRequestHandler]:
    site_root = directory.resolve()

    class StaticHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(site_root), **kwargs)

        def published_content(self, path):
            # Only anonymous reads go upstream, including for media referenced by a post.
            connection = http.client.HTTPConnection("127.0.0.1", cms_port, timeout=10)
            headers = {}
            if path.startswith("/media/") and self.headers.get("Range"):
                headers["Range"] = self.headers["Range"]
            try:
                connection.request(self.command, path, headers=headers)
                response = connection.getresponse()
                self.send_response(response.status)
                for key in ("Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"):
                    if value := response.getheader(key):
                        self.send_header(key, value)
                self.end_headers()
                return response
            except (OSError, http.client.HTTPException):
                connection.close()
                self.send_error(503, "Local CMS is unavailable")
                return None

        def send_head(self):
            try:
                request_url = urlsplit(self.path)
                if request_url.scheme or request_url.netloc:
                    raise ValueError("Absolute request targets are not served")
                request_path = unquote(request_url.path, encoding="utf-8", errors="strict")
                if cms_port:
                    if request_path == "/content/posts.json":
                        return self.published_content("/api/public/posts")
                    if re.fullmatch(r"/(?:news/[a-f0-9]{32}\.html|media/[a-f0-9]{32}(?:/poster)?)", request_path):
                        return self.published_content(request_path)
                if request_path == "/":
                    request_path = "/index.html"
                if request_path in ("/news", "/news/"):
                    if request_path == "/news":
                        self.send_response(302)
                        self.send_header("Location", "/news/")
                        self.send_header("Content-Length", "0")
                        self.end_headers()
                        return None
                    request_path = "/news/index.html"
                if request_path in ("/admin", "/admin/"):
                    if request_path == "/admin":
                        self.send_response(302)
                        self.send_header("Location", "/admin/")
                        self.send_header("Content-Length", "0")
                        self.end_headers()
                        return None
                    request_path = "/admin/index.html"
                if not request_path.startswith("/"):
                    raise ValueError("Expected an absolute path")
                parts = tuple(request_path[1:].split("/"))
                if not is_public_file(parts):
                    raise ValueError("Not a public website file")
                target = site_root.joinpath(*parts).resolve(strict=True)
                # Check again after resolution: links must not expose the rental
                # project, dotfiles, or anything outside the website directory.
                resolved_parts = target.relative_to(site_root).parts
                if not is_public_file(resolved_parts) or not target.is_file():
                    raise ValueError("Not a public regular file")
                source = target.open("rb")
            except (OSError, ValueError, UnicodeError, RuntimeError):
                self.send_error(404, "File not found")
                return None

            try:
                stat = os.fstat(source.fileno())
                self.send_response(200)
                self.send_header("Content-Type", self.guess_type(str(target)))
                self.send_header("Content-Length", str(stat.st_size))
                self.send_header("Last-Modified", self.date_time_string(stat.st_mtime))
                self.end_headers()
                return source
            except Exception:
                source.close()
                raise

        def list_directory(self, path):
            self.send_error(404, "File not found")
            return None

        def end_headers(self) -> None:
            # Helps mobile browsers fetch updated assets while testing changes.
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            self.send_header("X-Content-Type-Options", "nosniff")
            if urlsplit(self.path).path.startswith("/admin"):
                self.send_header("Referrer-Policy", "no-referrer")
                self.send_header("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
                self.send_header("X-Frame-Options", "DENY")
            super().end_headers()

    return StaticHandler


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the PEAKFORM static site locally for desktop and phone testing.",
    )
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to. Default: 0.0.0.0")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to. Default: 8000")
    parser.add_argument("--cms-port", type=int, help="Read published posts from the CMS on this PC.")
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not open the homepage automatically in the default browser.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    site_root = Path(__file__).resolve().parent
    handler = build_handler(site_root, args.cms_port)

    with http.server.ThreadingHTTPServer((args.host, args.port), handler) as server:
        local_host = "127.0.0.1" if args.host == "0.0.0.0" else args.host
        local_url = f"http://{local_host}:{args.port}/"
        lan_ip = detect_local_ip() if args.host == "0.0.0.0" else args.host
        lan_url = f"http://{lan_ip}:{args.port}/index.html"

        print("PEAKFORM local server is running.")
        print(f"Project folder : {site_root}")
        print(f"Desktop URL    : {local_url}")
        print(f"Phone URL      : {lan_url}")
        print("")
        print("If your phone is on the same Wi-Fi, open the Phone URL there.")
        print("Press Ctrl+C to stop the server.")

        if not args.no_browser:
            webbrowser.open(local_url)

        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
            return 0


if __name__ == "__main__":
    sys.exit(main())
