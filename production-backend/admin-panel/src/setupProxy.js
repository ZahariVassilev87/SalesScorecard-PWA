/**
 * Fallback proxy when something still uses root-relative URLs on the CRA dev server.
 * App code uses REACT_APP_* or http://localhost:3001 in development — this covers edge cases.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function proxyDevApi(app) {
  const target = process.env.ADMIN_PROXY_TARGET || 'http://localhost:3001';
  const api = { target, changeOrigin: true, logLevel: 'silent' };

  ['/auth', '/users', '/public-admin'].forEach((prefix) => {
    app.use(prefix, createProxyMiddleware(api));
  });
};
