// Serves the game in a desktop browser: node tools/serve.js
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '../app/src/main/assets/game'), T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
http.createServer((q, r) => {
  const u = q.url.split('?')[0], f = path.join(root, u === '/' ? 'index.html' : u);
  if (!f.startsWith(root + path.sep) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': (T[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(r);
}).listen(8137, '127.0.0.1');
