# Remaining Work

## Current Verification

The workspace currently passes `pnpm typecheck` and `pnpm test` (9 test files, 20 tests). A local smoke test also verified relay health, device pairing, agent WebSocket registration, and a real MCP SDK client calling the relay's `echo` tool.

That smoke test did **not** verify forwarding to a local MCP server. The current `echo` tool is implemented inside the relay. The agent connects and sends heartbeats, but it does not yet start configured MCP servers or handle forwarded `mcp.request` messages. The project is not yet a production-ready functional release.

## Phase Status

- [x] Phase 0: pnpm workspace, TypeScript build, and `.env.example` are present. Linting/formatting configuration and a production-ready startup workflow still need review.
- [ ] Phase 1: Protocol schemas, database schema, and an initial SQL migration exist. Add migration execution, repositories, and wire durable database persistence into relay services.
- [ ] Phase 2: Relay health/readiness and agent WebSocket registration/heartbeat work. Complete relay-to-agent request delivery, response routing, and integration tests.
- [ ] Phase 3: Agent connection, CLI, process-manager, and bridge components exist. Wire them together to run configured MCP servers over STDIO and process requests from the relay.
- [ ] Phase 4: The Streamable HTTP endpoint works with a real MCP SDK client, but currently exposes a relay-local echo tool. Route sessions and tool calls through the authenticated target device to its local MCP server.
- [ ] Phase 5: JWT verification and resource metadata components exist. Apply authentication and authorization to protected routes, confirm the real OneAuth contracts, and implement verified domain provisioning/lifecycle integration.
- [ ] Phase 6: Pairing and credential operations work in memory. Persist device and pairing state, protect enrollment/management operations, associate domains, and verify revocation/rotation across relay restarts.
- [ ] Phase 7: Rate limits, message-size checks, and connection-generation handling have partial coverage. Integrate automatic reconnect, jitter, ping/pong, request cleanup, process recovery, concurrency bounds, and a security review.
- [ ] Phase 8: Basic agent commands and introductory docs exist. Finish configuration persistence/validation, accurate setup and troubleshooting instructions, OneAuth/deployment guidance, and remote MCP client configuration.

## Functional Release Blockers

### Local MCP execution

- [ ] Parse and validate `MCP_SERVERS` without silently replacing invalid JSON with an empty configuration.
- [ ] Start each enabled local server as a persistent STDIO process.
- [ ] Connect to each process with the official MCP SDK client and discover its tools.
- [ ] Handle relay `mcp.request` messages in the agent, invoke the corresponding approved local MCP operation, and send correlated `mcp.response` messages.
- [ ] Keep local processes alive across requests; handle startup errors, unexpected exits, restart policy, and graceful shutdown.
- [ ] Restrict exposed tools and process environment; never allow remote requests to execute arbitrary commands or modify agent configuration.

### Relay routing and MCP sessions

- [ ] Replace the relay-local `echo` tool with device-targeted WebSocket forwarding.
- [ ] Resolve the target from an authorized hostname/domain mapping, not a caller-controlled `deviceId` query parameter or header.
- [ ] Preserve Streamable HTTP initialization, session IDs, tool discovery, invocation, errors, and transport semantics across the WebSocket bridge.
- [ ] Correlate requests and responses with timeouts, disconnect handling, stale-generation rejection, and cleanup of pending requests.
- [ ] Verify device isolation: one client/device must not route to or inspect another device.

### Database and lifecycle

- [ ] Add and document a migration command; verify migrations against PostgreSQL.
- [ ] Implement repositories for users, devices, domains, pairing codes, and agent events.
- [ ] Replace in-memory device, pairing, and domain maps with PostgreSQL-backed operations.
- [ ] Make pairing-code consumption and credential creation transactional and safe under concurrent requests.
- [ ] Persist revocation, rotation, last-seen status, and domain association; verify behavior after process restart.

### OneAuth and domain authorization

- [ ] Confirm OneAuth discovery metadata, supported token types, issuer, JWKS/introspection contract, scopes, and domain APIs from authoritative documentation or implementation.
- [ ] Apply authentication middleware to MCP and relevant management routes; do not treat the verifier existing as route protection.
- [ ] Enforce audience, scope, user ownership, device status, and domain status for every request.
- [ ] Implement domain lookup/provisioning and lifecycle synchronization only against verified OneAuth contracts.
- [ ] Validate and authenticate domain webhooks, including replay/duplicate handling, if the verified OneAuth contract uses webhooks.
- [ ] Test invalid signatures, issuer/audience mismatch, expiration, missing scopes, revoked devices, inactive domains, and opaque-token behavior if supported.

## Reliability and Security Hardening

- [ ] Wire reconnect backoff and jitter into the agent connection lifecycle; reauthenticate and re-register on reconnect.
- [ ] Add connection and registration timeouts, ping/pong liveness checks, and graceful relay/agent shutdown.
- [ ] Ensure stale sockets cannot remove or replace newer generations and stale responses cannot complete current requests.
- [ ] Bound pending requests, per-device concurrency, WebSocket buffers, local server count, and request duration.
- [ ] Rate-limit pairing, authentication failures, and management endpoints in addition to WebSocket message bursts.
- [ ] Validate all HTTP payloads, device IDs, hostnames, and configuration at the relevant boundaries.
- [ ] Fail fast on invalid production configuration; remove placeholder device credentials as usable defaults.
- [ ] Add a security review covering token/credential exposure, authorization bypass, process isolation, filesystem exposure, and denial-of-service limits.

## Production Operations and Documentation

- [ ] Deploy the relay behind public HTTPS with supported WebSocket upgrades and WSS agent connections.
- [ ] Configure production DNS/hostname routing and TLS for the chosen MCP domain arrangement.
- [ ] Configure PostgreSQL secrets, connection lifecycle, backup/restore, and migration rollout.
- [ ] Document provider limits, sleep/restart behavior, timeouts, quotas, and recovery expectations.
- [ ] Document the single-relay limitation: active connection routing is in memory; horizontal scaling needs shared routing or a broker.
- [ ] Add structured Pino events for startup/shutdown, pairing, connection lifecycle, auth failures, MCP request lifecycle, timeout, and local process failures; never log secrets.
- [ ] Make readiness reflect required dependencies, especially database connectivity when persistence is enabled.
- [ ] Correct CLI URL handling: the relay's agent WebSocket endpoint is `/v1/agent/connect`; accept a base URL and append the path consistently, or clearly validate/document the full endpoint.
- [ ] Make `config init` actually create a config file and make `config show` display safe/redacted configuration; support validated config loading and avoid printing credentials.
- [ ] Document actual enrollment, local server configuration, remote MCP client setup, OneAuth requirements, deployment, and troubleshooting without claiming unimplemented forwarding works.

## Required Release Tests

- [ ] End-to-end test: start a harmless local STDIO MCP server, connect the agent, initialize a remote MCP SDK client, list local tools, invoke a tool, and verify the result returns through the relay.
- [ ] Verify requests fail safely when the agent disconnects, a request times out, or the local MCP process exits.
- [ ] Verify pairing expiration/reuse, credential rotation/revocation, and reconnect behavior against persisted state.
- [ ] Verify authorization and isolation across two users, devices, domains, and MCP sessions.
- [ ] Run typecheck, unit/integration tests, migration checks, and the end-to-end suite in CI.
- [ ] Perform a production deployment smoke test with real HTTPS/WSS, PostgreSQL, and verified OneAuth credentials before declaring release readiness.

## Definition of Done

The project is ready for its first functional release only when an enrolled laptop agent starts an explicitly configured local MCP server, an authenticated remote MCP client can list and invoke an approved local tool through the relay, authorization and device/domain lifecycle checks are enforced, disconnects/timeouts are handled safely, and the critical paths above are covered by tests.
