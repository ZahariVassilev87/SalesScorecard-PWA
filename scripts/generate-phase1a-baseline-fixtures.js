#!/usr/bin/env node
/**
 * Generates real JSON baseline fixtures from a running local API (default http://localhost:3001).
 * Requires: node scripts/phase1a-minimal-seed.js + backend running.
 *
 *   API_BASE_URL=http://localhost:3001 node scripts/generate-phase1a-baseline-fixtures.js
 */

const fs = require('fs');
const path = require('path');

const BASE = (process.env.API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const OUT = path.join(
  __dirname,
  '..',
  'production-backend',
  'docs',
  'phase1a-baseline'
);

async function req(method, url, { headers = {}, body } = {}) {
  const r = await fetch(`${BASE}${url}`, {
    method,
    headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { _raw: text };
  }
  return { status: r.status, body: parsed };
}

function redactTokens(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  if (clone.token) clone.token = '<REDACTED_JWT_ACCESS>';
  if (clone.refreshToken) clone.refreshToken = '<REDACTED_JWT_REFRESH>';
  if (clone.response && typeof clone.response === 'object') {
    if (clone.response.token) clone.response.token = '<REDACTED_JWT_ACCESS>';
    if (clone.response.refreshToken) clone.response.refreshToken = '<REDACTED_JWT_REFRESH>';
  }
  return clone;
}

async function main() {
  const fixtures = [];

  const loginOkReq = { email: 'lead@phase1a.local', password: 'password' };
  const loginOk = await req('POST', '/auth/login', { body: loginOkReq });
  fixtures.push({
    name: 'auth.login.success',
    method: 'POST',
    route: '/auth/login',
    request: loginOkReq,
    status: loginOk.status,
    response: loginOk.body,
  });

  const loginFailReq = { email: 'lead@phase1a.local', password: 'wrong-password' };
  const loginFail = await req('POST', '/auth/login', { body: loginFailReq });
  fixtures.push({
    name: 'auth.login.fail',
    method: 'POST',
    route: '/auth/login',
    request: loginFailReq,
    status: loginFail.status,
    response: loginFail.body,
  });

  const token = loginOk.body && loginOk.body.token;
  if (!token) {
    console.error('Login success did not return token; cannot continue fixture generation.');
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}` };

  const cats = await req('GET', '/scoring/categories', { headers: auth });
  const firstItem =
    Array.isArray(cats.body) && cats.body[0] && Array.isArray(cats.body[0].items)
      ? cats.body[0].items[0]
      : null;
  const behaviorItemId = firstItem && firstItem.id;

  const salespeople = await req('GET', '/organizations/salespeople', { headers: auth });
  const salespersonId =
    Array.isArray(salespeople.body) && salespeople.body[0] ? salespeople.body[0].id : '';

  const evalSuccessBody = {
    salespersonId,
    visitDate: new Date().toISOString(),
    customerName: `Phase1A OK ${Date.now()}`,
    customerType: 'LOW_SHARE',
    location: 'Sofia',
    overallComment: 'baseline success',
    items: [{ behaviorItemId, rating: 3, comment: 'ok' }],
  };
  const evalOk = await req('POST', '/evaluations', { headers: auth, body: evalSuccessBody });
  fixtures.push({
    name: 'evaluations.create.success',
    method: 'POST',
    route: '/evaluations',
    request: evalSuccessBody,
    status: evalOk.status,
    response: evalOk.body,
  });

  const evalBadBody = {
    ...evalSuccessBody,
    customerName: `Phase1A BAD ${Date.now()}`,
    items: [{ behaviorItemId, rating: 0, comment: 'invalid' }],
  };
  const evalBad = await req('POST', '/evaluations', { headers: auth, body: evalBadBody });
  fixtures.push({
    name: 'evaluations.create.validation_fail',
    method: 'POST',
    route: '/evaluations',
    request: evalBadBody,
    status: evalBad.status,
    response: evalBad.body,
  });

  const myEvals = await req('GET', '/evaluations/my', { headers: auth });
  fixtures.push({
    name: 'evaluations.my.success',
    method: 'GET',
    route: '/evaluations/my',
    request: null,
    status: myEvals.status,
    response: myEvals.body,
  });

  const dash = await req('GET', '/analytics/dashboard', { headers: auth });
  fixtures.push({
    name: 'analytics.dashboard.success',
    method: 'GET',
    route: '/analytics/dashboard',
    request: null,
    status: dash.status,
    response: dash.body,
  });

  const team = await req('GET', '/analytics/team', { headers: auth });
  fixtures.push({
    name: 'analytics.team.success',
    method: 'GET',
    route: '/analytics/team',
    request: null,
    status: team.status,
    response: team.body,
  });

  const myUnauthorized = await req('GET', '/evaluations/my');
  fixtures.push({
    name: 'evaluations.my.unauthorized_no_token',
    method: 'GET',
    route: '/evaluations/my',
    request: null,
    note: 'No Authorization header',
    status: myUnauthorized.status,
    response: myUnauthorized.body,
  });

  const spLogin = await req('POST', '/auth/login', {
    body: { email: 'salesperson@phase1a.local', password: 'password' },
  });
  const spToken = spLogin.body && spLogin.body.token;
  const evalForbidden = await req('POST', '/evaluations', {
    headers: { Authorization: `Bearer ${spToken}` },
    body: evalSuccessBody,
  });
  fixtures.push({
    name: 'evaluations.create.forbidden_salesperson',
    method: 'POST',
    route: '/evaluations',
    request: evalSuccessBody,
    note: 'SALESPERSON role cannot create evaluations',
    status: evalForbidden.status,
    response: evalForbidden.body,
  });

  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fixtures) {
    const safe = redactTokens(f);
    fs.writeFileSync(path.join(OUT, `${f.name}.json`), JSON.stringify(safe, null, 2));
  }
  fs.writeFileSync(
    path.join(OUT, '_index.json'),
    JSON.stringify(
      fixtures.map((f) => ({ name: f.name, route: f.route, method: f.method, status: f.status })),
      null,
      2
    )
  );
  console.log(`Wrote ${fixtures.length} fixtures to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
