import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

// Development serves the source tree while deployment serves only the build
// artifact. Most hosts invoke `npm start`, so keeping this choice in the server
// makes the repository runnable without provider-specific configuration.
const root = resolve(process.argv.includes('--dist') ? 'dist' : '.');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let file = normalize(join(root, pathname === '/' ? 'index.html' : pathname));
  if (file !== root && !file.startsWith(`${root}/`)) { response.writeHead(403).end('Forbidden'); return; }
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    response.writeHead(200, { 'Content-Type': `${types[extname(file)] || 'application/octet-stream'}; charset=utf-8` });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`Veilfall is running at http://localhost:${port}`));
