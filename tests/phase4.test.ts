import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createRelayApp } from '../apps/relay/src/server.ts';

describe('phase 4 remote MCP transport', () => {
  let activeServer: ReturnType<typeof createRelayApp> | undefined;

  afterEach(async () => {
    if (activeServer) {
      await activeServer.app.close();
      activeServer = undefined;
    }
  });

  it('exposes a streamable HTTP endpoint and routes tool calls to a device', async () => {
    activeServer = createRelayApp();
    await activeServer.app.ready();
    await activeServer.app.listen({ host: '127.0.0.1', port: 0 });

    const address = activeServer.app.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const url = new URL(`/mcp?deviceId=device_123`, `http://127.0.0.1:${port}`);

    const transport = new StreamableHTTPClientTransport(url);
    const client = new Client({ name: 'phase4-client', version: '1.0.0' }, { capabilities: {} });

    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.some((tool) => tool.name === 'echo')).toBe(true);

    const result = await client.callTool({ name: 'echo', arguments: { text: 'hello from remote' } });
    const textContent = result.content
      .filter((item) => item.type === 'text')
      .map((item) => ('text' in item ? item.text : ''))
      .join(' ');

    expect(textContent).toContain('device_123');
    expect(textContent).toContain('hello from remote');

    await client.close();
  }, 20000);
});
