import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { Principal } from '../auth/oneauth.js';
import { AgentRegistry } from './agent-registry.js';

export function createMeshMcpServer(principal: Principal, registry: AgentRegistry): McpServer {
  const server = new McpServer({ name: 'mcp-mesh', version: '0.1.0' });
  server.registerTool('mesh_list_connected_agents', { description: 'List connected MCP Mesh agents belonging to your organization.', inputSchema: z.object({}) }, async () => ({ content: [{ type: 'text', text: JSON.stringify(registry.listOnline(principal.organizationId), null, 2) }] }));
  server.registerTool('mesh_call_agent_tool', {
    description: 'Call a tool on one of your organization’s connected MCP Mesh agents. The relay enforces organization isolation.',
    inputSchema: z.object({ agentId: z.string().uuid(), toolName: z.string().min(1).max(128), arguments: z.record(z.string(), z.unknown()).default({}) }),
  }, async ({ agentId, toolName, arguments: args }) => {
    try { return { content: [{ type: 'text', text: JSON.stringify(await registry.callTool(agentId, principal.organizationId, toolName, args)) }] }; }
    catch (error) { return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : 'Agent call failed' }] }; }
  });
  return server;
}
