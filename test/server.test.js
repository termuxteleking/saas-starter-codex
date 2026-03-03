const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createServer, hostingPlan } = require('../src/server');

function request(server, path, { method = 'GET', headers = {}, body } = {}) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const req = http.request({ method, port, path, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : {}
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

test('free plan exists and auth is required for bots API', async () => {
  assert.equal(hostingPlan.monthlyPriceUsd, 0);

  const server = createServer().listen(0);

  try {
    const unauth = await request(server, '/api/bots');
    assert.equal(unauth.status, 401);

    const reg = await request(server, '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { name: 'A', email: 'a@a.com', password: 'pass123' }
    });
    assert.equal(reg.status, 201);

    const login = await request(server, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'a@a.com', password: 'pass123' }
    });
    assert.equal(login.status, 200);
    const cookie = login.headers['set-cookie'][0].split(';')[0];

    const createBot = await request(server, '/api/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: { name: 'My Bot', telegramToken: '123456:ABCDEFtoken', flow: ['welcome-message'] }
    });

    assert.equal(createBot.status, 201);
    assert.equal(createBot.body.bot.flow.length, 1);
  } finally {
    server.close();
  }
});
