import http.server
import socketserver
import os

PORT = 8000
# Serve from the root of the project
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

print(f"Starting Python HTTP server on port {PORT}...")
print(f"👉 Local Test Page: http://localhost:{PORT}/test.html")
print(f"🎯 OBS Link (Default): http://localhost:{PORT}/public/index.html")
print(f"🎯 OBS Link (Neon Theme): http://localhost:{PORT}/public/index.html?theme=neon")
print("Press Ctrl+C to stop.")

try:
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServer stopped.")
