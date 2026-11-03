import { env, type AgentConfig } from './config.js';
import { AgentConnection } from './connection.js';
import { buildAgentConfigTemplate, parseAgentCliArgs, printAgentHelp } from './cli.js';

export async function startAgent(overrides: Partial<AgentConfig> = {}): Promise<AgentConnection> {
  const config = { ...env, ...overrides };
  const connection = new AgentConnection({
    relayUrl: config.relayUrl,
    deviceId: config.deviceId,
    deviceToken: config.deviceToken,
    heartbeatMs: config.heartbeatMs,
  });

  await connection.connect();
  console.info(`MCP Mesh agent started for device ${config.deviceId}`);

  return connection;
}

export async function runAgentCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseAgentCliArgs(argv);

  if (parsed.help || parsed.command === 'help') {
    printAgentHelp();
    return;
  }

  if (parsed.command === 'config') {
    console.info(buildAgentConfigTemplate());
    return;
  }

  const connection = await startAgent({
    relayUrl: parsed.relayUrl ?? env.relayUrl,
    deviceId: parsed.deviceId ?? env.deviceId,
    deviceToken: parsed.deviceToken ?? env.deviceToken,
    heartbeatMs: parsed.heartbeatMs ?? env.heartbeatMs,
    reconnectMaxMs: parsed.reconnectMaxMs ?? env.reconnectMaxMs,
  });

  void connection;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  void runAgentCli();
}
