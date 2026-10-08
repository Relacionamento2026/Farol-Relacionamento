// UI-only harness. No Supabase SDK, credentials, network database or RLS simulation.
import http from 'node:http';
import {readFileSync} from 'node:fs';
const root = new URL('../../', import.meta.url);
const page = readFileSync(new URL('index.html', root), 'utf8')
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase[^\"]+"><\/script>/, '<script src="/mock.js"></script>')
  .replace(/<link[^>]+href="https:[^>]+>/g, '');
if (!page.includes('<script src="/mock.js"></script>')) throw new Error('SDK replacement failed');
const routes = {
  '/': ['text/html', page],
  '/mock.js': ['text/javascript', readFileSync(new URL('mock.js', import.meta.url))],
  '/assets/private-storage.js':['text/javascript',readFileSync(new URL('assets/private-storage.js', root))],
  '/assets/access-control.js': ['text/javascript', readFileSync(new URL('assets/access-control.js', root))]
};
http.createServer((req,res) => {
  const route = routes[new URL(req.url, 'http://localhost').pathname];
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-src 'none'; font-src 'self'; form-action 'none'");
  res.writeHead(route ? 200 : 404, {'Content-Type':route?.[0] || 'text/plain'});
  res.end(route?.[1] || 'Not found');
}).listen(4173, '127.0.0.1', () => console.log('UI mock only: http://127.0.0.1:4173'));
