# NishantApps MCP Mesh

NishantApps MCP Mesh is a distributed MCP connectivity platform that lets a local MCP server run on a user laptop while remote AI clients connect through a public HTTPS relay.

## Current status

The repository contains working foundations for the relay, agent connection, pairing, token verification, and reliability controls. The local MCP server forwarding path and production authorization/deployment are not yet complete. See [docs/remaining-work.md](docs/remaining-work.md) for the phase-by-phase status and release checklist.

## Workspace layout

- apps/relay — public relay and pairing/auth flow
- apps/agent — local device agent CLI
- packages/protocol — shared MCP protocol validation
- packages/oneauth — OneAuth token verification boundary
- packages/database — database schema and client access
- packages/mcp-bridge — local bridge helpers
- packages/shared — shared utilities

## Install and verify

```bash
pnpm install
pnpm typecheck
pnpm test
```

## Agent CLI

The local agent is available as a CLI in the workspace:

```bash
pnpm --dir apps/agent build
pnpm --dir apps/agent start
```

For configuration guidance:

```bash
pnpm --dir apps/agent exec node dist/index.js config init
pnpm --dir apps/agent exec node dist/index.js help
```

You can also run the compiled binary directly after linking dependencies:

```bash
mcp-mesh-agent start --relay-url "wss://relay.example.com" --device-id "device-123" --device-token "your-device-token"
```

## Required environment variables

```bash
export RELAY_URL="wss://relay.example.com"
export DEVICE_ID="device-123"
export DEVICE_TOKEN="replace-with-your-device-token"
export MCP_SERVERS='{"filesystem":{"transport":"stdio","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/tmp"],"enabled":true}}'
```

## OneAuth integration notes

JWT verification and OAuth resource metadata components are present, but protected-route enforcement and domain lifecycle integration against verified OneAuth contracts remain unfinished. Do not use the current setup as a production authorization boundary.

## Deployment notes

- Run the relay as a public HTTPS service with the configured OneAuth metadata.
- Run the agent on the user laptop as an outbound WebSocket client.
- Keep device credentials local to the laptop and never expose them to remote MCP clients.
- Pair and rotate device credentials through the relay’s validated enrollment flow.

## Troubleshooting

- If the agent cannot connect, verify the relay URL and device credential values.
- If a request times out, confirm the relay’s request timeout and the local MCP server startup path.
- If the relay rejects requests, check OneAuth audience, issuer, and scope validation.
- If a device reconnects unexpectedly, ensure the relay is using the latest generation tracking and cleanup logic.
- If a WebSocket payload is rejected, reduce the payload size or adjust the configured relay limit.

## Release status

The current tests and local smoke checks cover foundations, not the complete laptop-to-relay-to-remote-client flow. The project is not yet ready for production release; use the [remaining work checklist](docs/remaining-work.md) to track the outstanding implementation and verification gates.
