// ── KairosHR Proxy + Servidor estático ───────────────────────────────────────
//
//  Uso:  node proxy.js
//  URL:  http://<IP-del-servidor>:3001
//
//  • Sirve los ficheros estáticos (calc.html, calc.css, calc.js, kairos.service.js)
//    desde la misma carpeta donde está este script.
//  • Reenvía las rutas /login y /checkin/* a la API de KairosHR (sin CORS).
//  • No requiere npm install — solo módulos nativos de Node.js.

const http = require('http');
const https = require('https');
const fs   = require('fs');
const path = require('path');

// ── Configuración ─────────────────────────────────────────────────────────────
const PORT    = 3001;
const API_URL = 'https://portal.kairoshr.es/api-service/v1';
const API     = new (require('url').URL)(API_URL);

// Rutas que se reenvían a la API de KairosHR
const API_PREFIXES = ['/login', '/checkin'];

// Tipos MIME para los ficheros estáticos
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
};

// ── Servidor ──────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0]; // ruta sin query string

  // ── 1. Rutas de API → proxy hacia KairosHR ──────────────────────────────
  const isApi = API_PREFIXES.some(p => reqPath.startsWith(p));

  if (isApi) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    const options = {
      hostname: API.hostname,
      port:     443,
      path:     API.pathname + req.url,   // incluye query string
      method:   req.method,
      headers:  { ...req.headers, host: API.hostname },
    };
    delete options.headers['origin'];
    delete options.headers['referer'];

    const proxyReq = https.request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode, {
        ...proxyRes.headers,
        ...corsHeaders(),
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
      console.error('[proxy] Error API:', err.message);
      res.writeHead(502, corsHeaders());
      res.end(JSON.stringify({ error: err.message }));
    });

    req.pipe(proxyReq);
    return;
  }

  // ── 2. Resto → servir fichero estático ──────────────────────────────────
  // / → index = calc.html
  let filePath = reqPath === '/' ? '/calc.html' : reqPath;
  filePath = path.join(__dirname, filePath);

  const ext      = path.extname(filePath).toLowerCase();
  const mimeType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('500 Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ── Arranque ──────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const ips = Object.values(nets).flat()
    .filter(n => n.family === 'IPv4' && !n.internal)
    .map(n => n.address);

  console.log('\n✅  Servidor activo');
  console.log(`    Local:   http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`    Red:     http://${ip}:${PORT}`));
  console.log('\n    Los trabajadores deben abrir la URL de Red en su Chrome.\n');
});
