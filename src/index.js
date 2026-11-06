import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8787);
const BASE_DOMAIN = (process.env.BASE_DOMAIN || 'mcp.nishantapps.in').toLowerCase();
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 3_600_000);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30_000);
const WS_TOKEN = process.env.WS_TOKEN || '';
const sessions = new Map();
const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function sessionFor(slug) {
  let session = sessions.get(slug);
  if (!session) {
    session = { slug, socket: null, pending: new Map(), tools: [], touchedAt: Date.now() };
    sessions.set(slug, session);
  }
  session.touchedAt = Date.now();
  return session;
}

function sendSocket(session, message) {
  if (!session.socket || session.socket.readyState !== WebSocket.OPEN) {
    throw Object.assign(new Error('No WebSocket peer is connected to this session'), { status: 503 });
  }
  session.socket.send(JSON.stringify(message));
}

function requestPeer(session, method, params = {}) {
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      session.pending.delete(id);
      reject(Object.assign(new Error(`WebSocket peer timed out handling ${method}`), { status: 504 }));
    }, REQUEST_TIMEOUT_MS);
    session.pending.set(id, { resolve, reject, timer });
    try { sendSocket(session, { type: 'mcp.request', id, method, params }); }
    catch (error) { clearTimeout(timer); session.pending.delete(id); reject(error); }
  });
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function getSlug(req) {
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  const suffix = `.${BASE_DOMAIN}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  return slug && !slug.includes('.') && slugPattern.test(slug) ? slug : null;
}

async function handleMcp(req, res, session) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) return json(res, 413, rpcError(null, -32700, 'Request too large'));
  }
  let message;
  try { message = JSON.parse(body); }
  catch { return json(res, 400, rpcError(null, -32700, 'Parse error')); }
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return json(res, 400, rpcError(message?.id, -32600, 'Invalid JSON-RPC request'));
  }
  const id = message.id;
  if (message.method === 'initialize') {
    return json(res, 200, {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: message.params?.protocolVersion || '2025-03-26',
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: `mcp-mesh-${session.slug}`, version: '1.0.0' }
      }
    });
  }
  if (message.method === 'notifications/initialized' || message.method === 'notifications/cancelled') return res.writeHead(202).end();
  if (message.method === 'ping') return json(res, 200, { jsonrpc: '2.0', id, result: {} });
  if (message.method === 'tools/list' || message.method === 'tools/call') {
    try {
      const result = await requestPeer(session, message.method, message.params || {});
      if (message.method === 'tools/list') session.tools = Array.isArray(result?.tools) ? result.tools : [];
      return json(res, 200, { jsonrpc: '2.0', id, result });
    } catch (error) {
      return json(res, error.status || 502, rpcError(id, -32000, error.message));
    }
  }
  return json(res, 200, rpcError(id, -32601, `Method not found: ${message.method}`));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, sessions: sessions.size });
  const slug = getSlug(req);
  if (!slug) return json(res, 421, { error: `Use a subdomain of ${BASE_DOMAIN}` });
  const session = sessionFor(slug);
  if (url.pathname === '/mcp' && req.method === 'POST') return handleMcp(req, res, session);
  if (url.pathname === '/mcp' && req.method === 'GET') return json(res, 405, { error: 'Use stateless Streamable HTTP POST requests' }, { allow: 'POST' });
  return json(res, 404, { error: 'Not found' });
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 1_000_000 });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const slug = getSlug(req);
  if (!slug || url.pathname !== '/ws' || (WS_TOKEN && url.searchParams.get('token') !== WS_TOKEN)) {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req, slug));
});

wss.on('connection', (ws, _req, slug) => {
  const session = sessionFor(slug);
  if (session.socket && session.socket.readyState === WebSocket.OPEN) {
    ws.close(1013, 'This session already has a connected WebSocket peer');
    return;
  }
  session.socket = ws;
  ws.send(JSON.stringify({ type: 'mcp.connected', session: slug }));
  ws.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    if (message.type === 'mcp.result' && typeof message.id === 'string') {
      const pending = session.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      session.pending.delete(message.id);
      if (message.error) pending.reject(new Error(String(message.error.message || message.error)));
      else pending.resolve(message.result ?? {});
    }
    if (message.type === 'tools.updated' && Array.isArray(message.tools)) session.tools = message.tools;
  });
  ws.on('close', () => {
    if (session.socket === ws) session.socket = null;
    for (const [id, pending] of session.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('WebSocket peer disconnected'));
      session.pending.delete(id);
    }
  });
  ws.on('error', () => {});
});

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [slug, session] of sessions) {
    if (!session.socket && session.pending.size === 0 && session.touchedAt < cutoff) sessions.delete(slug);
  }
}, Math.min(60_000, SESSION_TTL_MS)).unref();

server.listen(PORT, HOST, () => console.log(`MCP Mesh listening on ${HOST}:${PORT} for *.${BASE_DOMAIN}`));
