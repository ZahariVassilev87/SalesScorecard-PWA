const http = require('http');
const https = require('https');

const TARGET_HOST = 'api.instorm.io';
const TARGET_PORT = 443;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    return res.end();
  }

  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: TARGET_HOST
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    setCors(res);
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    setCors(res);
    res.statusCode = 502;
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(proxyReq, { end: true });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`PWA local proxy listening on http://localhost:${PORT} -> https://${TARGET_HOST}`);
});
