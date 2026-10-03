#!/usr/bin/env python3
"""Serve the built PWA locally without installing JavaScript dependencies."""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import webbrowser


class AppHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(302)
            self.send_header('Location', '/CreatorDock/')
            self.end_headers()
            return
        if not self.path.startswith('/CreatorDock/'):
            self.send_error(404)
            return
        super().do_GET()

    def translate_path(self, path):
        return super().translate_path(path.removeprefix('/CreatorDock'))

    def list_directory(self, path):
        self.send_error(404)
        return None


def main():
    parser = argparse.ArgumentParser(description='Open the built CreatorDock app on this computer.')
    parser.add_argument('--port', type=int, default=5187)
    parser.add_argument('--no-open', action='store_true')
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('Port must be between 1024 and 65535.')
    dist = Path(__file__).resolve().parent.parent / 'dist'
    if not (dist / 'index.html').is_file():
        sys.exit('Missing dist/index.html. Run npm ci and npm run build first, or use the ready-to-run ZIP.')
    handler = functools.partial(AppHandler, directory=str(dist))
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as error:
        sys.exit(f'Cannot start on port {args.port}: {error}. Close the previous app server or select --port.')
    url = f'http://127.0.0.1:{args.port}/CreatorDock/'
    print(f'CreatorDock: {url}\nKeep this window open. Press Ctrl+C to stop.', flush=True)
    if not args.no_open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nCreatorDock stopped.')
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
