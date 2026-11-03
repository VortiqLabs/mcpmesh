import { env } from './config.js';

export type AgentCliCommand = 'start' | 'config' | 'help';

export type ParsedAgentCliArgs = {
  command: AgentCliCommand;
  configAction: 'init' | 'show';
  relayUrl?: string;
  deviceId?: string;
  deviceToken?: string;
  heartbeatMs?: number;
  reconnectMaxMs?: number;
  help: boolean;
};

export function parseAgentCliArgs(argv: string[] = process.argv.slice(2)): ParsedAgentCliArgs {
  const parsed: ParsedAgentCliArgs = {
    command: 'start',
    configAction: 'show',
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case 'start':
        parsed.command = 'start';
        break;
      case 'config':
        parsed.command = 'config';
        if (argv[index + 1] === 'init' || argv[index + 1] === 'show') {
          parsed.configAction = argv[index + 1] as 'init' | 'show';
          index += 1;
        }
        break;
      case 'help':
      case '--help':
      case '-h':
        parsed.help = true;
        parsed.command = 'help';
        break;
      case '--relay-url':
        parsed.relayUrl = argv[index + 1] ?? env.relayUrl;
        index += 1;
        break;
      case '--device-id':
        parsed.deviceId = argv[index + 1] ?? env.deviceId;
        index += 1;
        break;
      case '--device-token':
        parsed.deviceToken = argv[index + 1] ?? env.deviceToken;
        index += 1;
        break;
      case '--heartbeat-ms': {
        const value = Number(argv[index + 1] ?? env.heartbeatMs);
        parsed.heartbeatMs = Number.isFinite(value) ? value : env.heartbeatMs;
        index += 1;
        break;
      }
      case '--reconnect-max-ms': {
        const value = Number(argv[index + 1] ?? env.reconnectMaxMs);
        parsed.reconnectMaxMs = Number.isFinite(value) ? value : env.reconnectMaxMs;
        index += 1;
        break;
      }
      default:
        break;
    }
  }

  return parsed;
}

export function buildAgentConfigTemplate(): string {
  return [
    '# MCP Mesh Agent configuration',
    '# Copy these values into your shell or .env file before starting the agent.',
    '',
    'RELAY_URL=wss://relay.example.com',
    'DEVICE_ID=device-123',
    'DEVICE_TOKEN=replace-with-your-device-token',
    'MCP_SERVERS={"filesystem":{"transport":"stdio","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/tmp"],"enabled":true}}',
    'AGENT_HEARTBEAT_INTERVAL_SECONDS=25',
    'AGENT_RECONNECT_MAX_SECONDS=60',
    '',
    '# Example start command:',
    'mcp-mesh-agent start --relay-url "wss://relay.example.com" --device-id "device-123" --device-token "replace-with-your-device-token"',
    '',
    '# Or export the values in your shell before running:',
    'export RELAY_URL="wss://relay.example.com"',
    'export DEVICE_ID="device-123"',
    'export DEVICE_TOKEN="replace-with-your-device-token"',
  ].join('\n');
}

export function printAgentHelp(): void {
  const helpText = [
    'MCP Mesh Agent CLI',
    '',
    'Usage:',
    '  mcp-mesh-agent start [--relay-url <url>] [--device-id <id>] [--device-token <token>]',
    '  mcp-mesh-agent config [init|show]',
    '  mcp-mesh-agent help',
    '',
    'Environment variables:',
    '  RELAY_URL, DEVICE_ID, DEVICE_TOKEN, MCP_SERVERS, AGENT_HEARTBEAT_INTERVAL_SECONDS, AGENT_RECONNECT_MAX_SECONDS',
    '',
    'Notes:',
    '  - The relay URL should be the public WebSocket endpoint, typically wss://<subdomain>.mcp.nishantapps.in',
    '  - Device credentials should never be shared with remote MCP clients',
  ].join('\n');

  console.info(helpText);
}
