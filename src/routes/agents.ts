import type { FastifyInstance } from 'fastify';
import { WebSocketServer } from 'ws';
import { and, eq } from 'drizzle-orm';
import { verifyBearerToken } from '../auth/oneauth.js';
import { db } from '../db/client.js';
import { agents, organizations } from '../db/schema.js';
import { AgentRegistry } from '../mesh/agent-registry.js';

export async function registerAgentRoutes(app: FastifyInstance, registry: AgentRegistry): Promise<WebSocketServer> {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1_048_576, perMessageDeflate: false });
  app.server.on('upgrade', (request, socket, head) => {
    if (new URL(request.url ?? '/', 'http://localhost').pathname !== '/agent/ws') return;
    void (async () => {
      try {
        const principal = await verifyBearerToken(request.headers.authorization);
        const [agent] = await db.select({ id: agents.id, organizationId: agents.organizationId }).from(agents)
          .innerJoin(organizations, eq(agents.organizationId, organizations.id))
          .where(and(eq(agents.oneAuthSubject, principal.subject), eq(organizations.oneAuthOrganizationId, principal.organizationId))).limit(1);
        if (!agent) throw new Error('No agent is registered for this OneAuth subject and organization');
        wss.handleUpgrade(request, socket, head, (ws) => {
          registry.attach(agent.id, agent.organizationId, ws);
          void db.update(agents).set({ status: 'online', lastSeenAt: new Date() }).where(eq(agents.id, agent.id));
        });
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); socket.destroy();
      }
    })();
  });
  return wss;
}
