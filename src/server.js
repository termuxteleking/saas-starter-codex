const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 3000;

let nextBotId = 1;
const bots = [];
const users = [];
const sessions = new Map();

const hostingPlan = {
  name: 'Free Forever',
  monthlyPriceUsd: 0,
  description: 'Unlimited drag-and-drop Telegram bot building and hosting for everyone.',
  features: ['Unlimited bots', 'Drag-and-drop flow builder', 'No subscription or credit card required']
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const [rawKey, rawValue] = part.trim().split('=');
    if (rawKey && rawValue) acc[rawKey] = decodeURIComponent(rawValue);
    return acc;
  }, {});
}

function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies.session;
  if (!token || !sessions.has(token)) return null;
  const userId = sessions.get(token);
  return users.find((user) => user.id === userId) || null;
}

function requireAuth(req, res) {
  const user = getSessionUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Authentication required' });
    return null;
  }
  return user;
}

function serveStatic(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const requestedFile = pathname === '/' ? '/index.html' : pathname;
  const decoded = decodeURIComponent(requestedFile);
  const filePath = path.normalize(path.join(__dirname, '..', 'public', decoded));
  const publicRoot = path.join(__dirname, '..', 'public');

  if (!filePath.startsWith(publicRoot)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json'
    };

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(data);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

async function handleRequest(req, res, options = {}) {
  const { serveStaticFiles = true } = options;
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { status: 'ok' });
  }

  if (req.method === 'GET' && pathname === '/api/plan') {
    return sendJson(res, 200, { plan: hostingPlan });
  }

  if (req.method === 'GET' && pathname === '/api/auth/me') {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 200, { user: null });
    return sendJson(res, 200, { user: { id: user.id, email: user.email, name: user.name } });
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    try {
      const { name, email, password } = await parseBody(req);
      if (!name || !email || !password) {
        return sendJson(res, 400, { error: 'name, email, and password are required' });
      }

      const existing = users.find((user) => user.email === email.toLowerCase());
      if (existing) return sendJson(res, 409, { error: 'Email already registered' });

      const newUser = {
        id: users.length + 1,
        name,
        email: email.toLowerCase(),
        passwordHash: crypto.createHash('sha256').update(password).digest('hex')
      };
      users.push(newUser);

      return sendJson(res, 201, { user: { id: newUser.id, email: newUser.email, name: newUser.name } });
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON payload' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    try {
      const { email, password } = await parseBody(req);
      if (!email || !password) return sendJson(res, 400, { error: 'email and password are required' });

      const user = users.find((entry) => entry.email === email.toLowerCase());
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      if (!user || user.passwordHash !== passwordHash) {
        return sendJson(res, 401, { error: 'Invalid credentials' });
      }

      const sessionToken = crypto.randomUUID();
      sessions.set(sessionToken, user.id);
      res.setHeader('Set-Cookie', `session=${encodeURIComponent(sessionToken)}; HttpOnly; Path=/; SameSite=Lax`);
      return sendJson(res, 200, { user: { id: user.id, email: user.email, name: user.name } });
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON payload' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const cookies = parseCookies(req);
    if (cookies.session) sessions.delete(cookies.session);
    res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/bots') {
    const user = requireAuth(req, res);
    if (!user) return;
    return sendJson(res, 200, { bots: bots.filter((bot) => bot.ownerId === user.id) });
  }

  if (req.method === 'POST' && pathname === '/api/bots') {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const { name, telegramToken, webhookUrl, flow = [] } = await parseBody(req);
      if (!name || !telegramToken) {
        return sendJson(res, 400, { error: 'name and telegramToken are required' });
      }

      const bot = {
        id: nextBotId++,
        ownerId: user.id,
        name,
        maskedToken: `${telegramToken.slice(0, 6)}...${telegramToken.slice(-4)}`,
        webhookUrl: webhookUrl || null,
        flow,
        status: 'deployed',
        createdAt: new Date().toISOString(),
        plan: hostingPlan.name
      };

      bots.push(bot);
      return sendJson(res, 201, { bot });
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON payload' });
    }
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/bots/')) {
    const user = requireAuth(req, res);
    if (!user) return;
    const botId = Number(pathname.split('/').pop());
    const index = bots.findIndex((bot) => bot.id === botId && bot.ownerId === user.id);
    if (index === -1) return sendJson(res, 404, { error: 'Bot not found' });
    const [removed] = bots.splice(index, 1);
    return sendJson(res, 200, { removed });
  }

  if (serveStaticFiles) {
    return serveStatic(req, res);
  }

  return sendJson(res, 404, { error: 'Not found' });
}

function createServer() {
  return http.createServer((req, res) => {
    handleRequest(req, res, { serveStaticFiles: true });
  });
}

if (require.main === module) {
  createServer().listen(PORT, () => {
    console.log(`BotForge running on http://localhost:${PORT}`);
  });
}

module.exports = { createServer, handleRequest, hostingPlan };
