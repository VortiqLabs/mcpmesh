import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const MCP_PATH = process.env.MCP_PATH || '/mcp';
const DEVICE_PATH = process.env.DEVICE_WS_PATH || '/device';
const AGENT_WS_PATH = process.env.AGENT_WS_PATH || '/agent';
const AGENT_OAUTH_CLIENT_ID = process.env.ONEAUTH_AGENT_CLIENT_ID || 'oa_8WSUjKeAT6CaaJLdZ1Lsr-oHu-ow3LHT';
const ONEAUTH_ISSUER = required('ONEAUTH_ISSUER_URL').replace(/\/$/, '');
const INTROSPECTION_URL = process.env.ONEAUTH_INTROSPECTION_URL || `${ONEAUTH_ISSUER}/api/oauth/introspect`;
const RESOURCE_URL = required('ONEAUTH_RESOURCE_URL').replace(/\/$/, '');
const RESOURCE_SERVER_KEY = required('ONEAUTH_RESOURCE_SERVER_KEY');
for (const [name, value] of [['ONEAUTH_ISSUER_URL', ONEAUTH_ISSUER], ['ONEAUTH_RESOURCE_URL', RESOURCE_URL]]) {
  const parsed = new URL(value);
  const localHttp = process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !localHttp) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${name} must be a canonical HTTPS URL (HTTP is allowed only for localhost development)`);
  }
}
const ALLOWED_ORIGINS = (process.env.MCP_ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.some(rule => {
    if (!rule.includes('*')) return origin === rule;
    try {
      const expected = new URL(rule.replace('*.', 'wildcard.'));
      const actual = new URL(origin);
      const suffix = expected.hostname.slice('wildcard'.length);
      return expected.protocol === actual.protocol && expected.port === actual.port &&
        actual.hostname.endsWith(suffix) && actual.hostname !== suffix.slice(1);
    } catch { return false; }
  });
}
const devices = new Map();
const agents = new Map();
const selectedAgents = new Map();
const pendingToolRequests = new Map();
const AGENT_TOOLS = JSON.parse(await readFile(new URL('./agent-tools.json', import.meta.url), 'utf8'));
if (!Array.isArray(AGENT_TOOLS) || AGENT_TOOLS.length !== 40) {
  throw new Error('The bundled Agent tool catalogue must contain exactly 40 tools');
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}


function bearerFrom(request) {
  const value = request.headers.authorization || '';
  if (!value.startsWith('Bearer ')) return '';
  return value.slice(7).trim();
}

async function callOneAuthIntrospection(token) {
  const response = await fetch(INTROSPECTION_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'cache-control': 'no-store',
      'x-oneauth-resource-server-key': RESOURCE_SERVER_KEY
    },
    body: new URLSearchParams({ token, token_type_hint: 'access_token' }),
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    throw new Error(`OneAuth introspection failed (${response.status})`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error('OneAuth introspection returned invalid JSON');
  }
}

async function introspect(token) {
  if (!token || token.length > 512) return null;
  const result = await callOneAuthIntrospection(token);
  if (!result.active || typeof result.sub !== 'string' || !result.sub || result.aud !== RESOURCE_URL || result.iss !== ONEAUTH_ISSUER) return null;
  const scopes = String(result.scope || '').split(/\s+/).filter(Boolean);
  if (!scopes.includes('mcp:connect')) return null;
  if (!Number.isFinite(result.exp) || result.exp * 1000 <= Date.now()) return null;
  return { subject: String(result.sub), clientId: String(result.client_id || ''), scopes, expiresAt: result.exp * 1000 };
}

async function authenticateRequest(request) {
  const token = bearerFrom(request);
  if (!token) return null;
  return introspect(token);
}

// Agent connections use the VS Code extension's dedicated OneAuth OAuth client.
// Unlike MCP access tokens, these tokens are not required to target the MCP resource audience.
async function introspectAgentToken(token, includeFailureReason = false) {
  const fail = reason => includeFailureReason ? { principal: null, reason } : null;
  const pass = principal => includeFailureReason ? { principal, reason: null } : principal;
  if (!token || token.length > 512) return fail('Bearer token is missing or exceeds the 512-character limit');

  const result = await callOneAuthIntrospection(token);
  if (!result || typeof result !== 'object') return fail('OneAuth returned an invalid introspection response');
  if (result.active !== true) return fail('OneAuth reports that the access token is inactive');
  if (typeof result.sub !== 'string' || !result.sub) return fail('Introspection response is missing the subject (sub)');
  if (result.iss !== ONEAUTH_ISSUER) return fail('Token issuer (iss) does not match ONEAUTH_ISSUER_URL');
  if (result.client_id !== AGENT_OAUTH_CLIENT_ID) return fail('Token client_id does not match ONEAUTH_AGENT_CLIENT_ID');

  const scopes = String(result.scope || '').split(/\s+/).filter(Boolean);
  if (!scopes.includes('openid')) return fail('Token scope does not include openid');
  if (!Number.isFinite(result.exp)) return fail('Introspection response is missing a valid expiry (exp)');
  if (result.exp * 1000 <= Date.now()) return fail('Access token has expired');

  return pass({ subject: String(result.sub), clientId: String(result.client_id), scopes, expiresAt: result.exp * 1000 });
}

function getSelectedAgent(subject) {
  const selectedId = selectedAgents.get(subject);
  if (selectedId) {
    const selected = agents.get(`${subject}:${selectedId}`);
    if (selected?.socket.readyState === WebSocket.OPEN) return selected;
  }
  const connected = [...agents.values()].filter(agent => agent.subject === subject && agent.socket.readyState === WebSocket.OPEN);
  if (connected.length === 1) {
    selectedAgents.set(subject, connected[0].agentId);
    return connected[0];
  }
  if (connected.length > 1) throw new Error('Multiple VS Code Agents are connected. Call agent.list and agent.select before using workspace tools.');
  throw new Error('No VS Code Agent is connected. Open VortiqLabs Agent in VS Code and sign in to OneAuth.');
}

function dispatchAgentTool(subject, tool, args = {}) {
  const agent = getSelectedAgent(subject);
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingToolRequests.delete(requestId);
      reject(new Error(`Agent tool ${tool} timed out after 120 seconds.`));
    }, 120_000);
    timeout.unref();
    pendingToolRequests.set(requestId, { agentKey: `${agent.subject}:${agent.agentId}`, resolve, reject, timeout });
    const payload = JSON.stringify({ type: 'tool.execute', requestId, tool, arguments: args });
    if (Buffer.byteLength(payload) > 16 * 1024 * 1024) {
      clearTimeout(timeout); pendingToolRequests.delete(requestId); reject(new Error('Tool arguments exceed the 16 MB limit.')); return;
    }
    agent.socket.send(payload, error => {
      if (!error) return;
      const pending = pendingToolRequests.get(requestId);
      if (pending) { clearTimeout(pending.timeout); pendingToolRequests.delete(requestId); pending.reject(new Error(`Could not send request to VS Code Agent: ${error.message}`)); }
    });
  });
}

function createMcpServer(principal) {
  const server = new McpServer({ name: 'VortiqLabs MCP Mesh', version: '1.0.0' }, {
    instructions: 'Authenticated through OneAuth. Agent and device tools are scoped to the authenticated OneAuth subject. Use agent.list and agent.select to choose a connected VS Code workspace before workspace operations when multiple Agents are online.'
  });

  server.tool('device.list', 'List this authenticated user’s currently connected devices.', {}, async () => {
    const userDevices = [...devices.values()]
      .filter(device => device.subject === principal.subject)
      .map(({ deviceId, connectedAt }) => ({ deviceId, connectedAt }));
    return { content: [{ type: 'text', text: JSON.stringify(userDevices, null, 2) }], structuredContent: { devices: userDevices } };
  });

  server.tool('device.send', 'Send a JSON message to one of this user’s connected devices.', {
    deviceId: z.string().min(1).max(128),
    message: z.record(z.unknown())
  }, async ({ deviceId, message }) => {
    const device = devices.get(`${principal.subject}:${deviceId}`);
    if (!device || device.socket.readyState !== WebSocket.OPEN) {
      return { isError: true, content: [{ type: 'text', text: `Device ${deviceId} is not connected.` }] };
    }
    const serialized = JSON.stringify({ type: 'message', message });
    if (Buffer.byteLength(serialized) > 64 * 1024) {
      return { isError: true, content: [{ type: 'text', text: 'Message exceeds the 64 KB limit.' }] };
    }
    device.socket.send(serialized);
    return { content: [{ type: 'text', text: `Message sent to ${deviceId}.` }], structuredContent: { sent: true, deviceId } };
  });

  server.tool('agent.list', 'List this authenticated OneAuth user’s connected VS Code Agent instances and workspaces.', {}, async () => {
    const connected = [...agents.values()].filter(agent => agent.subject === principal.subject && agent.socket.readyState === WebSocket.OPEN).map(agent => ({ agentId: agent.agentId, workspaceId: agent.workspaceId, workspaceName: agent.workspaceName, connectedAt: agent.connectedAt, selected: selectedAgents.get(principal.subject) === agent.agentId }));
    return { content: [{ type: 'text', text: JSON.stringify(connected, null, 2) }], structuredContent: { agents: connected } };
  });

  server.tool('agent.select', 'Select the VS Code Agent instance that receives subsequent workspace tool calls for this OneAuth user.', { agentId: z.string().min(1).max(128) }, async ({ agentId }) => {
    const target = agents.get(`${principal.subject}:${agentId}`);
    if (!target || target.socket.readyState !== WebSocket.OPEN) return { isError: true, content: [{ type: 'text', text: 'That Agent is not connected to your OneAuth account.' }] };
    selectedAgents.set(principal.subject, agentId);
    return { content: [{ type: 'text', text: `Selected ${target.workspaceName} (${agentId}) for subsequent tool calls.` }], structuredContent: { selected: true, agentId, workspaceId: target.workspaceId } };
  });

  for (const tool of AGENT_TOOLS) {
    server.registerTool(tool.name, { description: tool.description, inputSchema: z.fromJSONSchema(tool.inputSchema) }, async args => {
      try {
        const result = await dispatchAgentTool(principal.subject, tool.name, args);
        return { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { isError: true, content: [{ type: 'text', text: `${tool.name} failed: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    });
  }

  return server;
}

function logWebSocketAttempt(request, endpoint) {
  console.info('[WebSocket] Connection requested', JSON.stringify({
    endpoint,
    remoteAddress: request.socket.remoteAddress || 'unknown',
    origin: request.headers.origin || null
  }));
}

function logWebSocketRejected(request, endpoint, reason, status) {
  console.warn('[WebSocket] Connection rejected', JSON.stringify({ endpoint, status, reason }));
}

function logWebSocketConnected(request, endpoint) {
  console.info('[WebSocket] Connection accepted', JSON.stringify({
    endpoint,
    remoteAddress: request.socket.remoteAddress || 'unknown'
  }));
}

function rejectWebSocketUpgrade(request, socket, endpoint, status, message, reason = message) {
  logWebSocketRejected(request, endpoint, reason, status);
  if (socket.destroyed) return;
  const body = JSON.stringify({ error: message });
  const statusText = status === 502 ? 'Bad Gateway' : status === 503 ? 'Service Unavailable' : status === 403 ? 'Forbidden' : 'Unauthorized';
  socket.end(`HTTP/1.1 ${status} ${statusText}\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

function json(response, status, value, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  response.end(JSON.stringify(value));
}

function resourceMetadata() {
  return {
    resource: RESOURCE_URL,
    authorization_servers: [ONEAUTH_ISSUER],
    bearer_methods_supported: ['header'],
    scopes_supported: ['mcp:connect'],
    resource_documentation: `${ONEAUTH_ISSUER}/developer/oidc`
  };
}

const httpServer = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/health') return json(response, 200, { ok: true, service: 'vortiqlabs-mcp-mesh' });
  if (url.pathname === '/.well-known/oauth-protected-resource' || url.pathname === '/.well-known/oauth-protected-resource/mcp') {
    return json(response, 200, resourceMetadata(), { 'cache-control': 'public, max-age=300' });
  }
  if (url.pathname !== MCP_PATH) return json(response, 404, { error: 'not_found' });

  const origin = request.headers.origin;
  if (origin && !isAllowedOrigin(origin)) return json(response, 403, { error: 'origin_not_allowed' });
  if (origin) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('access-control-expose-headers', 'MCP-Session-Id');
    response.setHeader('vary', 'Origin');
  }
  if (request.method === 'OPTIONS') {
    if (!origin || !isAllowedOrigin(origin)) return response.writeHead(403).end();
    response.writeHead(204, {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
      'access-control-allow-headers': 'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id',
      'access-control-expose-headers': 'MCP-Session-Id',
      vary: 'Origin'
    });
    return response.end();
  }
  if (!['GET', 'POST', 'DELETE'].includes(request.method || '')) return json(response, 405, { error: 'method_not_allowed' }, { allow: 'GET, POST, DELETE, OPTIONS' });

  let principal;
  try { principal = await authenticateRequest(request); }
  catch (error) {
    return json(response, 503, { error: 'authorization_server_unavailable' });
  }
  if (!principal) {
    return json(response, 401, { error: 'invalid_token' }, {
      'www-authenticate': `Bearer resource_metadata="${new URL('/.well-known/oauth-protected-resource/mcp', RESOURCE_URL).toString()}"`
    });
  }

  try {
    let body;
    if (request.method === 'POST') {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 1024 * 1024) return json(response, 413, { error: 'request_too_large' });
        chunks.push(chunk);
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    const mcp = createMcpServer(principal);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcp.connect(transport);
    await transport.handleRequest(request, response, body);
    response.on('close', () => { void transport.close(); void mcp.close(); });
  } catch (error) {
    console.error('MCP request failed:', error);
    if (!response.headersSent) json(response, 400, { error: 'invalid_mcp_request' });
    else response.end();
  }
});

const wsServer = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
const agentWsServer = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 * 1024 });
httpServer.on('upgrade', async (request, socket, head) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const endpoint = url.pathname;
  logWebSocketAttempt(request, endpoint);

  if (endpoint === AGENT_WS_PATH) {
    const token = bearerFrom(request);
    if (!token) return rejectWebSocketUpgrade(request, socket, endpoint, 401, 'missing_agent_token', 'Authorization Bearer token is missing');
    if (token.length > 512) return rejectWebSocketUpgrade(request, socket, endpoint, 401, 'invalid_agent_token', 'Bearer token exceeds the 512-character limit');
    let principal;
    try {
      const validation = await introspectAgentToken(token, true);
      principal = validation.principal;
      if (!principal) {
        return rejectWebSocketUpgrade(request, socket, endpoint, 401, 'invalid_agent_token', validation.reason);
      }
    } catch (error) {
      return rejectWebSocketUpgrade(request, socket, endpoint, 502, 'oneauth_introspection_failed', error instanceof Error ? error.message : 'OneAuth introspection failed');
    }
    return agentWsServer.handleUpgrade(request, socket, head, ws => {
      logWebSocketConnected(request, endpoint);
      agentWsServer.emit('connection', ws, request, principal, token);
    });
  }

  if (endpoint !== DEVICE_PATH) return rejectWebSocketUpgrade(request, socket, endpoint, 404, 'websocket_endpoint_not_found', 'Unknown WebSocket endpoint');
  const origin = request.headers.origin;
  if (origin && !isAllowedOrigin(origin)) return rejectWebSocketUpgrade(request, socket, endpoint, 403, 'origin_not_allowed', 'Origin is not in MCP_ALLOWED_ORIGINS');
  const token = bearerFrom(request);
  if (!token) return rejectWebSocketUpgrade(request, socket, endpoint, 401, 'missing_access_token', 'Authorization Bearer token is missing');
  if (token.length > 512) return rejectWebSocketUpgrade(request, socket, endpoint, 401, 'invalid_access_token', 'Bearer token exceeds the 512-character limit');
  let principal;
  try {
    principal = await introspect(token);
  } catch (error) {
    return rejectWebSocketUpgrade(request, socket, endpoint, 502, 'oneauth_introspection_failed', error instanceof Error ? error.message : 'OneAuth introspection failed');
  }
  if (!principal) return rejectWebSocketUpgrade(request, socket, endpoint, 401, 'invalid_access_token', 'Token is inactive or does not satisfy the issuer, resource audience, mcp:connect scope, or expiry requirements');
  return wsServer.handleUpgrade(request, socket, head, ws => {
    logWebSocketConnected(request, endpoint);
    wsServer.emit('connection', ws, request, principal, token);
  });
});

agentWsServer.on('connection', (socket, _request, principal, token) => {
  let registeredKey = null;
  let revalidationRunning = false;
  const heartbeatTimer = setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.ping(); }, 25_000);
  heartbeatTimer.unref();
  const revalidationTimer = setInterval(async () => {
    if (revalidationRunning || socket.readyState !== WebSocket.OPEN) return;
    revalidationRunning = true;
    try { const current = await introspectAgentToken(token); if (!current || current.subject !== principal.subject) socket.close(1008, 'Agent authorization expired or revoked'); }
    catch { socket.close(1011, 'OneAuth unavailable'); }
    finally { revalidationRunning = false; }
  }, 30_000);
  revalidationTimer.unref();
  socket.send(JSON.stringify({ type: 'agent.connected', expiresAt: principal.expiresAt }));
  socket.on('message', raw => {
    try {
      const message = JSON.parse(raw.toString());
      if (message?.type === 'agent.register') {
        const agentId = String(message.agentId || '').trim();
        const workspaceId = String(message.workspaceId || '').trim();
        const workspaceName = String(message.workspaceName || 'Workspace').slice(0, 160);
        if (!/^[A-Za-z0-9._:-]{1,128}$/.test(agentId) || !/^[A-Za-z0-9._:-]{1,128}$/.test(workspaceId)) { socket.send(JSON.stringify({ type: 'agent.error', error: 'invalid_agent_identity' })); return socket.close(1008, 'Invalid Agent identity'); }
        registeredKey = `${principal.subject}:${agentId}`;
        const previous = agents.get(registeredKey);
        if (previous && previous.socket !== socket) previous.socket.close(4001, 'Replaced by a newer connection');
        agents.set(registeredKey, { subject: principal.subject, agentId, workspaceId, workspaceName, socket, connectedAt: new Date().toISOString() });
        if (!selectedAgents.has(principal.subject) || !agents.has(`${principal.subject}:${selectedAgents.get(principal.subject)}`)) selectedAgents.set(principal.subject, agentId);
        socket.send(JSON.stringify({ type: 'agent.registered', agentId, workspaceId }));
        return;
      }
      if (message?.type === 'tool.result') {
        if (!registeredKey || typeof message.requestId !== 'string') return;
        const pending = pendingToolRequests.get(message.requestId);
        if (!pending || pending.agentKey !== registeredKey) return;
        clearTimeout(pending.timeout); pendingToolRequests.delete(message.requestId);
        if (message.success === true) pending.resolve(message.result);
        else pending.reject(new Error(String(message.error?.message || 'Agent tool execution failed.')));
        return;
      }
      if (message?.type === 'agent.pong') return;
      socket.send(JSON.stringify({ type: 'agent.error', error: 'unsupported_message' }));
    } catch { socket.send(JSON.stringify({ type: 'agent.error', error: 'invalid_json' })); }
  });
  socket.on('close', () => {
    clearInterval(revalidationTimer);
    clearInterval(heartbeatTimer);
    if (registeredKey && agents.get(registeredKey)?.socket === socket) {
      agents.delete(registeredKey);
      for (const [requestId, pending] of pendingToolRequests) {
        if (pending.agentKey === registeredKey) { clearTimeout(pending.timeout); pendingToolRequests.delete(requestId); pending.reject(new Error('VS Code Agent disconnected before returning a result.')); }
      }
      if (selectedAgents.get(principal.subject) === registeredKey.split(':').slice(1).join(':')) {
        const replacement = [...agents.values()].find(agent => agent.subject === principal.subject && agent.socket.readyState === WebSocket.OPEN);
        if (replacement) selectedAgents.set(principal.subject, replacement.agentId); else selectedAgents.delete(principal.subject);
      }
    }
  });
  socket.on('error', error => console.warn('Agent WebSocket error:', error.message));
});

wsServer.on('connection', (socket, _request, principal, token) => {
  let registeredKey = null;
  let revalidationRunning = false;
  const revalidationTimer = setInterval(async () => {
    if (revalidationRunning || socket.readyState !== WebSocket.OPEN) return;
    revalidationRunning = true;
    try {
      const current = await introspect(token);
      if (!current || current.subject !== principal.subject) socket.close(1008, 'Authorization expired or revoked');
    } catch {
      socket.close(1011, 'Authorization service unavailable');
    } finally { revalidationRunning = false; }
  }, 30_000);
  revalidationTimer.unref();
  socket.send(JSON.stringify({ type: 'connected', subject: principal.subject, expiresAt: principal.expiresAt }));
  socket.on('message', raw => {
    try {
      const message = JSON.parse(raw.toString());
      if (message?.type === 'register') {
        const deviceId = String(message.deviceId || '').trim();
        if (!/^[A-Za-z0-9._:-]{1,128}$/.test(deviceId)) return socket.close(1008, 'Invalid deviceId');
        registeredKey = `${principal.subject}:${deviceId}`;
        const previous = devices.get(registeredKey);
        if (previous && previous.socket !== socket) previous.socket.close(4001, 'Replaced by a newer connection');
        devices.set(registeredKey, { subject: principal.subject, deviceId, socket, connectedAt: new Date().toISOString() });
        socket.send(JSON.stringify({ type: 'registered', deviceId }));
        return;
      }
      if (message?.type === 'pong') return;
      socket.send(JSON.stringify({ type: 'error', error: 'unsupported_message' }));
    } catch { socket.send(JSON.stringify({ type: 'error', error: 'invalid_json' })); }
  });
  socket.on('close', () => {
    clearInterval(revalidationTimer);
    if (registeredKey && devices.get(registeredKey)?.socket === socket) devices.delete(registeredKey);
  });
  socket.on('error', error => console.warn('Device WebSocket error:', error.message));
});

httpServer.listen(PORT, HOST, () => {
  console.log(`MCP Mesh listening on http://${HOST}:${PORT}`);
  console.log(`MCP endpoint: ${MCP_PATH}; device WebSocket: ${DEVICE_PATH}; Agent WebSocket: ${AGENT_WS_PATH}`);
  console.log(`OneAuth issuer: ${ONEAUTH_ISSUER}`);
  console.log(`OAuth resource: ${RESOURCE_URL}`);
});

process.on('SIGINT', () => { for (const device of devices.values()) device.socket.close(1001, 'Server shutting down'); for (const agent of agents.values()) agent.socket.close(1001, 'Server shutting down'); httpServer.close(() => process.exit(0)); });
process.on('SIGTERM', () => { for (const device of devices.values()) device.socket.close(1001, 'Server shutting down'); for (const agent of agents.values()) agent.socket.close(1001, 'Server shutting down'); httpServer.close(() => process.exit(0)); });
