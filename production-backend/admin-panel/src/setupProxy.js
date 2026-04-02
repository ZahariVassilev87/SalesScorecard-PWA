/**
 * Dev-server proxy: forwards API paths to the Node backend so GET /public-admin/companies/.../config
 * is not answered by the webpack dev server (which would 404).
 * Target must match where production-backend listens (see docker-compose.dev.yml: 3001).
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function proxyDevApi(app) {
  const target = process.env.ADMIN_PROXY_TARGET || 'http://localhost:3001';
  const api = { target, changeOrigin: true, logLevel: 'silent' };

  // Auth + profile (admin login uses POST /auth/login, GET /users/profile/me)
  app.use('/auth', createProxyMiddleware(api));
  app.use('/users', createProxyMiddleware(api));
  app.use(
    '/public-admin/companies',
    createProxyMiddleware(api)
  );
};
