# NishantApps MCP Mesh — Complete GitHub Copilot Implementation Instructions

## 1. Project Overview

Build **NishantApps MCP Mesh**, a distributed MCP (Model Context Protocol) connectivity platform.

The purpose of MCP Mesh is to allow users to expose MCP servers running locally on their laptops to remote AI clients through public HTTPS endpoints.

For example:

A user has an MCP server running locally:

```text
stdio: npx my-mcp-server
```

They install and run the MCP Mesh Agent on their laptop. The agent connects to the central MCP Mesh Relay using an outbound persistent WebSocket connection.

MCP Mesh assigns the user's device a public subdomain:

```text
https://a8f3k2.mcp.nishantapps.in/mcp
```

A remote AI client connects to that URL. The central relay forwards MCP requests through the existing WebSocket connection to the user's laptop. The local agent communicates with the actual MCP server and returns the response through the relay.

The user should not need:
- Port forwarding
- A public IP address
- A manually configured reverse proxy
- Cloudflare Tunnel
- A publicly exposed local MCP server

The platform must integrate with **OneAuth**, which is the existing NishantApps authentication and domain-provisioning platform.

## 2. Critical Development Rules

Before writing code, follow these rules:

1. Inspect the existing repository and understand its structure.
2. Do not overwrite existing code or configuration without understanding it.
3. Do not invent OneAuth API endpoints, database schemas, OAuth claims, or webhook contracts.
4. Inspect the actual OneAuth implementation, documentation, and discovery metadata wherever available.
5. If a required OneAuth integration contract is missing, create a clearly documented integration interface and report what needs to be confirmed. Do not silently pretend the integration works.
6. Implement the system incrementally in working phases.
7. Use TypeScript throughout.
8. Use strict TypeScript settings. Avoid `any` wherever possible.
9. Validate all network messages and external inputs.
10. Write tests for important functionality.
11. Do not add unnecessary dependencies.
12. Do not build a dashboard or frontend. This project is strictly the MCP Mesh core.
13. Do not introduce Redis, Kafka, RabbitMQ, Kubernetes, Socket.IO, or other infrastructure without a demonstrated requirement.
14. Do not hardcode secrets, OAuth credentials, database credentials, or device tokens.
15. Never expose local MCP server credentials or OneAuth user tokens to remote clients.
16. Keep the relay and laptop agent independently deployable.

If a decision depends on an unknown OneAuth capability, stop at the relevant integration boundary, document the missing contract, and continue implementing independently testable components.

## 3. Technology Stack

Use the following stack.

| Component | Technology |
|---|---|
| Language | TypeScript |
| Runtime | Node.js 22 LTS |
| Package manager | pnpm |
| HTTP server | Fastify |
| WebSocket | ws |
| MCP SDK | @modelcontextprotocol/sdk |
| Remote MCP transport | MCP Streamable HTTP |
| Local MCP transport | STDIO initially |
| Validation | Zod |
| OAuth integration | OneAuth |
| JWT verification | jose |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| PostgreSQL driver | postgres |
| Logging | Pino |
| Testing | Vitest |

Use the official MCP TypeScript SDK and its currently supported transport APIs. Check the installed SDK version and its documentation rather than copying outdated MCP transport examples.

Do not implement a custom MCP protocol parser.

## 4. System Architecture

The platform consists of two primary applications.

### A. Central Relay

The relay is publicly hosted and handles:

- HTTPS requests from AI clients.
- OAuth token validation through OneAuth.
- Device hostname resolution.
- Active device connection tracking.
- MCP request forwarding.
- WebSocket communication with laptop agents.
- Request correlation and response delivery.
- Device connection lifecycle.
- Domain status enforcement.

The relay must expose a public HTTPS endpoint.

Example:

```text
https://a8f3k2.mcp.nishantapps.in/mcp
```

### B. Local Agent

The agent runs on the user's laptop.

It handles:

- Connecting to the central relay.
- Device authentication.
- Persistent WebSocket communication.
- Local MCP server process management.
- STDIO communication with local MCP servers.
- MCP request and response forwarding.
- Reconnection after network failures.
- Graceful shutdown.
- Local process cleanup.

The agent initiates the connection to the relay.

The relay must never require an inbound connection to the user's laptop.

### C. Request Flow

Implement this request flow:

```text
                 AI CLIENT
                     |
                     |
             HTTPS / MCP Request
                     |
                     v
             CENTRAL RELAY
                     |
              OneAuth OAuth
                Validation
                     |
              Hostname Lookup
                     |
              Device Registry
                     |
                     v
              WebSocket Relay
                     |
              Persistent WSS
                     |
                     v
                LAPTOP AGENT
                     |
              Local MCP Bridge
                     |
                     v
              Local MCP Server
                     |
                MCP Response
                     |
                     v
                LAPTOP AGENT
                     |
                WebSocket
                     |
                     v
                CENTRAL RELAY
                     |
                HTTPS Response
                     |
                     v
                  AI CLIENT
```

The relay must support multiple connected devices simultaneously.

Each device must have an isolated request-routing context.

## 5. Repository Structure

Create a pnpm monorepo with this structure:

```text
mcp-mesh/
│
├── apps/
│   ├── relay/
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── config.ts
│   │   │   ├── router.ts
│   │   │   ├── websocket.ts
│   │   │   ├── registry.ts
│   │   │   ├── request-manager.ts
│   │   │   ├── auth/
│   │   │   │   ├── middleware.ts
│   │   │   │   ├── token-verifier.ts
│   │   │   │   └── resource-metadata.ts
│   │   │   ├── device/
│   │   │   │   ├── device-service.ts
│   │   │   │   └── device-routes.ts
│   │   │   └── domain/
│   │   │       ├── domain-service.ts
│   │   │       └── domain-webhooks.ts
│   │   └── package.json
│   │
│   └── agent/
│       ├── src/
│       │   ├── index.ts
│       │   ├── config.ts
│       │   ├── connection.ts
│       │   ├── heartbeat.ts
│       │   ├── reconnect.ts
│       │   ├── device-auth.ts
│       │   ├── process-manager.ts
│       │   ├── mcp-bridge.ts
│       │   └── transports/
│       │       └── stdio.ts
│       └── package.json
│
├── packages/
│   ├── protocol/
│   │   ├── src/
│   │   │   ├── messages.ts
│   │   │   ├── schemas.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── oneauth/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── discovery.ts
│   │   │   ├── oauth.ts
│   │   │   ├── jwks.ts
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   ├── database/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── schema.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── mcp-bridge/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── shared/
│       ├── src/
│       │   ├── errors.ts
│       │   ├── logger.ts
│       │   └── types.ts
│       └── package.json
│
├── tests/
├── docs/
├── .env.example
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── README.md
```

Keep this structure modular. Do not put the entire application into one server file.

## 6. Central Relay Implementation

Implement the relay using Fastify.

### Required endpoints

Implement these endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check |
| `/ready` | GET | Readiness check |
| `/mcp` | GET/POST/DELETE | MCP Streamable HTTP endpoint |
| `/.well-known/oauth-protected-resource` | GET | OAuth resource metadata |
| `/v1/agent/connect` | WebSocket | Laptop agent connection |
| `/v1/devices/pair` | POST | Device pairing initiation |
| `/v1/devices/pair/complete` | POST | Device pairing completion |
| `/v1/devices/:id` | GET | Device status |
| `/v1/devices/:id/revoke` | POST | Revoke device credentials |
| `/v1/internal/domain-events` | POST | Domain lifecycle events, if OneAuth supports webhooks |

These are MCP Mesh routes. They are not assumptions about existing OneAuth routes.

### Hostname resolution

The relay must extract the device hostname from the incoming request.

Example:

```text
a8f3k2.mcp.nishantapps.in
```

Resolve the hostname to an active device and its associated domain record.

Validate:
- Hostname belongs to the expected domain.
- Device exists.
- Device is active.
- Domain is active.
- Device is currently connected.
- Requested resource path is allowed.

Do not trust arbitrary Host headers. Validate the incoming hostname against configured domain rules and trusted proxy settings.

### Request manager

Implement a request manager that:

1. Generates a unique request ID.
2. Associates the request with a device ID.
3. Sends the request over the correct WebSocket.
4. Waits for the corresponding response.
5. Rejects requests after a configurable timeout.
6. Removes completed requests from memory.
7. Handles disconnects and relay errors.
8. Prevents one device from receiving another device's requests.

Use a safe pending-request map for the initial single-relay deployment.

Never allow a client to choose an arbitrary internal device ID and use it to access another device.

### MCP Streamable HTTP

Use the official MCP SDK's Streamable HTTP server transport.

Do not replace MCP with a custom JSON API.

Ensure the relay correctly handles:
- MCP initialization.
- Protocol version negotiation.
- Session management where required by the SDK.
- Tool listing.
- Tool invocation.
- Notifications.
- Errors.
- Session termination.

The relay must preserve MCP protocol semantics while forwarding requests to the agent.

Do not assume that every MCP HTTP request is a standalone request-response exchange. Implement the transport according to the SDK's supported lifecycle and session behavior.

## 7. WebSocket Relay Protocol

Use the `ws` library.

The WebSocket connection must be authenticated and encrypted using WSS in deployment.

Define a versioned internal protocol.

Example message types:

### Agent registration

```json
{
  "type": "agent.register",
  "version": 1,
  "deviceId": "device_123"
}
```

### Heartbeat

```json
{
  "type": "agent.heartbeat",
  "timestamp": 1790000000000
}
```

### MCP request

```json
{
  "type": "mcp.request",
  "requestId": "req_123",
  "payload": {}
}
```

### MCP response

```json
{
  "type": "mcp.response",
  "requestId": "req_123",
  "payload": {}
}
```

### Error

```json
{
  "type": "error",
  "requestId": "req_123",
  "code": "REQUEST_FAILED",
  "message": "Unable to process request"
}
```

These are illustrative protocol shapes. Define and validate the final schema using Zod.

Requirements:

- Validate every incoming message.
- Reject unsupported protocol versions.
- Limit message size.
- Authenticate the agent before registering its connection.
- Maintain a connection heartbeat.
- Detect stale connections.
- Handle duplicate connections safely.
- Handle reconnection and connection replacement.
- Use request IDs to correlate responses.
- Prevent cross-device message routing.
- Avoid logging credentials or complete sensitive payloads.
- Handle WebSocket backpressure.
- Implement ping/pong handling.
- Clean up pending requests on disconnect.

The agent must not be able to claim another device's identity by sending a different `deviceId`.

The authenticated device identity must come from its validated device credential, not from an untrusted message field.

## 8. Laptop Agent Implementation

Build the agent as a Node.js CLI application.

The user should eventually be able to install and run it using a command similar to:

```bash
npx @nishantapps/mcp-mesh
```

Do not publish a package or claim this command works until package configuration and publishing are actually completed.

The agent should support commands similar to:

```bash
mcp-mesh login
mcp-mesh pair
mcp-mesh start
mcp-mesh status
mcp-mesh devices
mcp-mesh revoke
mcp-mesh config
```

Implement the CLI in a later phase after the underlying agent lifecycle works.

### Agent configuration

Allow users to configure local MCP servers.

Example configuration:

```json
{
  "servers": {
    "filesystem": {
      "transport": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/home/user/Documents"
      ],
      "enabled": true
    }
  }
}
```

This is an example configuration only.

Validate configuration with Zod.

Support:
- Multiple local MCP servers.
- Individual server enable/disable.
- Environment variables.
- Process startup.
- Process shutdown.
- Restart after unexpected process exit.
- Standard input/output communication.
- Per-server logging and error reporting.

Do not execute arbitrary configuration commands from remote clients.

Only the local user should configure or approve which MCP servers and directories are exposed.

### STDIO bridge

Use the official MCP SDK to connect to local MCP servers through STDIO.

The agent must:
1. Start the configured process.
2. Establish the MCP client connection.
3. Perform MCP initialization.
4. Handle incoming remote requests.
5. Forward them to the appropriate local MCP server.
6. Return the response to the relay.
7. Clean up the process and transport.

Never merge different MCP server sessions into one shared context unless the protocol implementation explicitly requires it.

## 9. OneAuth Integration

OneAuth is the existing identity, OAuth, and domain-provisioning authority.

Known issuer:

```text
https://oneauth.nishantapps.in
```

Before implementing integration, inspect OneAuth's actual OpenID Connect discovery document:

```text
https://oneauth.nishantapps.in/.well-known/openid-configuration
```

Also inspect the OneAuth repository and its existing API contracts if available.

Do not assume endpoint paths, token formats, scopes, claims, or internal API behavior.

### Responsibilities owned by OneAuth

OneAuth owns:

- User authentication.
- OAuth authorization and consent.
- OAuth access tokens.
- Refresh and revocation capabilities.
- Signing keys and JWKS, if applicable.
- User identity.
- Domain provisioning.
- Domain lifecycle.
- Domain suspension and deletion.

### Responsibilities owned by MCP Mesh

MCP Mesh owns:

- Device registration.
- Device pairing.
- Device credentials.
- Device connection lifecycle.
- WebSocket management.
- MCP request routing.
- Local MCP server management.
- Operational device status.

Do not create a second OAuth provider or duplicate OneAuth's identity system.

### OAuth resource server

MCP Mesh must behave as an OAuth-protected resource server.

An AI client accesses:

```text
https://a8f3k2.mcp.nishantapps.in/mcp
```

It authenticates using an access token issued by OneAuth.

Verify:
- Token signature, if JWT.
- Token issuer.
- Token audience or resource binding.
- Token expiry.
- Required scopes.
- Subject.
- Domain/device authorization.
- Domain active status.

Use `jose` for JWT verification when appropriate.

Use OneAuth introspection when the token is opaque or when required by the actual OneAuth contract.

Cache JWKS appropriately and handle key rotation.

Do not accept a token just because its signature is valid. Its issuer, resource audience, expiry, scopes, and authorization must also be correct.

### Resource indicators

Where supported by OneAuth, use OAuth Resource Indicators (RFC 8707) to bind tokens to the requested MCP resource.

Example resource:

```text
https://a8f3k2.mcp.nishantapps.in/mcp
```

The token for one device's MCP endpoint must not automatically authorize access to another device's endpoint.

### OAuth resource metadata

Expose:

```text
GET /.well-known/oauth-protected-resource
```

An illustrative response:

```json
{
  "resource": "https://a8f3k2.mcp.nishantapps.in/mcp",
  "authorization_servers": [
    "https://oneauth.nishantapps.in"
  ],
  "scopes_supported": [
    "mcp:connect",
    "mcp:tools",
    "mcp:tools:write"
  ],
  "bearer_methods_supported": [
    "header"
  ]
}
```

Generate the resource value from the validated request hostname and configured base domain.

Use the actual supported authorization server metadata and scopes from OneAuth. Do not advertise unsupported scopes.

When authentication is missing or invalid, return an appropriate 401 response and a `WWW-Authenticate` header referencing the resource metadata.

### Device identity is separate from user identity

This distinction is mandatory.

There are two separate authentication contexts:

**AI client:**
- Authenticates through OneAuth OAuth.
- Receives an access token.
- Uses that token to access an MCP resource.

**Laptop agent:**
- Authenticates using a dedicated device credential.
- Uses that credential to establish its WebSocket connection.
- Must not use a user's normal OAuth access token as its permanent device identity.

Never forward the AI client's OneAuth access token to a local MCP server.

Never expose the device credential to an AI client.

### Domain provisioning

OneAuth manages domains.

MCP Mesh must integrate with the real OneAuth domain-provisioning API after inspecting its implementation.

A possible integration contract would look conceptually like:

```text
MCP Mesh
   |
   | Authenticated internal request
   v
OneAuth Domain Service
   |
   v
Domain allocation
   |
   v
Domain ID + hostname + status
```

The following endpoint is only an example contract, not an assumed existing OneAuth endpoint:

```text
POST /internal/mesh/domains
```

Do not implement against this path unless it is confirmed in OneAuth.

The integration should support:
- Domain creation.
- Domain lookup.
- Domain status checks.
- Domain suspension.
- Domain revocation.
- Domain deletion.
- Ownership validation.

Use authenticated service-to-service communication for internal domain operations.

If OneAuth supports lifecycle webhooks, validate their signatures, timestamps, and replay protection.

Otherwise, implement a reconciliation mechanism using the documented OneAuth API.

### Wildcard DNS

The intended public domain structure is:

```text
*.mcp.nishantapps.in
```

All device subdomains route to the central relay.

For example:

```text
a8f3k2.mcp.nishantapps.in
b7x9p1.mcp.nishantapps.in
c2d8m4.mcp.nishantapps.in
```

Verify that OneAuth can provision and manage subdomains backed by this wildcard DNS configuration.

Do not create individual DNS records unnecessarily if wildcard DNS is already configured.

Domain provisioning must not be considered complete until OneAuth's actual behavior has been verified.

## 10. Device Pairing and Credential Management

Implement a secure device-pairing workflow.

Suggested lifecycle:

1. User authenticates through OneAuth.
2. User requests a new device pairing.
3. Relay generates a cryptographically random, short-lived pairing code.
4. User enters the pairing code in the laptop agent.
5. Agent submits the code over HTTPS.
6. Relay validates the code and associates the device with the authorized user.
7. Relay provisions or obtains the device's domain through OneAuth.
8. Relay creates a dedicated device credential.
9. Agent securely stores its credential locally.
10. Agent establishes its authenticated WebSocket connection.

Pairing requirements:

- Pairing codes must be single-use.
- Pairing codes must expire.
- Pairing attempts must be rate-limited.
- Credentials must be generated using cryptographically secure randomness.
- Store only a secure hash of device credentials when possible.
- Support device credential rotation.
- Support device revocation.
- Reject revoked credentials immediately.
- Never print full device credentials in logs.
- Never send device credentials to remote MCP clients.

Use appropriate secure storage for supported operating systems. Do not claim that a plain-text configuration file is secure storage.

## 11. Database Design

Use PostgreSQL with Drizzle ORM.

Keep durable metadata in PostgreSQL.

Do not store active WebSocket objects in PostgreSQL.

Initial tables:

### users

Store the external OneAuth subject identifier and relevant ownership metadata only where required.

Do not duplicate OneAuth passwords or authentication records.

### devices

Suggested fields:

```text
id
owner_subject
name
status
credential_hash
created_at
updated_at
last_seen_at
revoked_at
```

### domains

Suggested fields:

```text
id
device_id
oneauth_domain_id
hostname
resource_uri
status
created_at
updated_at
```

### pairing_codes

Suggested fields:

```text
id
code_hash
owner_subject
expires_at
used_at
created_at
```

### agent_events

Optional operational event history:

```text
id
device_id
event_type
metadata
created_at
```

Use migrations.

Add:
- Foreign keys.
- Appropriate indexes.
- Unique hostname constraints.
- Unique OneAuth domain ID constraints where appropriate.
- Status constraints.
- Timestamps.
- Transactional operations for pairing and provisioning.

Do not store access tokens unnecessarily.

Do not persist active WebSocket connection objects.

## 12. Security Requirements

Security is a core requirement, not a later enhancement.

Implement:

### Network security
- HTTPS in production.
- WSS for agent connections.
- Secure TLS configuration.
- Trusted proxy configuration.
- Hostname validation.

### Authentication
- OneAuth OAuth for AI clients.
- Separate device credentials for agents.
- Short-lived pairing codes.
- Credential rotation.
- Device revocation.
- Token validation.

### Authorization
- Check resource ownership.
- Check domain status.
- Check device status.
- Validate scopes.
- Prevent cross-device access.
- Restrict exposed tools to locally configured MCP servers.

### Input validation
- Zod validation for WebSocket messages.
- Zod validation for HTTP payloads.
- Validate hostnames.
- Validate device IDs.
- Enforce payload-size limits.
- Enforce timeouts.

### Abuse prevention
- Rate-limit pairing.
- Rate-limit authentication failures.
- Limit simultaneous requests per device.
- Limit pending requests.
- Limit WebSocket message size.
- Limit the number of configured local servers where appropriate.

### Local execution security

The local agent is a security boundary.

Remote MCP clients must never be able to:
- Execute arbitrary shell commands.
- Modify the agent's configuration.
- Add new local MCP servers.
- Read arbitrary filesystem paths.
- Access environment variables.
- Access unrelated local processes.
- Read device credentials.

The only remotely accessible functionality should be what the local user explicitly configured and exposed through approved MCP servers.

Do not add a generic remote shell feature.

## 13. Connection Management and Reliability

The agent must tolerate unreliable networks.

Implement:

- Automatic reconnection.
- Exponential backoff.
- Randomized reconnect jitter.
- Heartbeats.
- Ping/pong handling.
- Connection timeouts.
- Graceful shutdown.
- Stale connection cleanup.
- Pending request cleanup.
- Credential rotation handling.
- Process restart handling.

The relay must not assume a WebSocket connection lasts forever.

On reconnection:
- Reauthenticate the device.
- Re-register the connection.
- Replace stale connection references.
- Reconcile device state.
- Reject responses belonging to old connection generations.

Use a connection generation or equivalent mechanism to prevent stale WebSocket messages from being accepted after reconnection.

For the first release, support a single relay instance with an in-memory active connection registry.

PostgreSQL stores durable device metadata.

Do not add a distributed message broker yet. Document that horizontal scaling will require shared routing or a broker and that in-memory routing is limited to a single relay instance.

## 14. Environment Configuration

Create `.env.example`.

Include configuration variables such as:

```env
NODE_ENV=development

PORT=3000
HOST=0.0.0.0

DATABASE_URL=postgres://user:password@localhost:5432/mcp_mesh

MESH_BASE_DOMAIN=mcp.nishantapps.in

ONEAUTH_ISSUER=https://oneauth.nishantapps.in

ONEAUTH_CLIENT_ID=
ONEAUTH_CLIENT_SECRET=

ONEAUTH_INTERNAL_API_URL=
ONEAUTH_INTERNAL_API_TOKEN=

AGENT_PAIRING_TTL_SECONDS=300

AGENT_HEARTBEAT_INTERVAL_SECONDS=25

AGENT_RECONNECT_MAX_SECONDS=60

MCP_REQUEST_TIMEOUT_MS=30000

LOG_LEVEL=info
```

These variables are configuration placeholders. Determine which OneAuth credentials and internal API configuration are actually required after inspecting the real integration contract.

Do not commit `.env`.

Validate configuration at application startup.

Fail fast with useful errors when required production settings are missing.

## 15. Logging and Observability

Use Pino.

Log:
- Relay startup.
- Relay shutdown.
- Device pairing.
- Device connection.
- Device disconnection.
- Reconnection.
- Authentication failures.
- MCP request lifecycle.
- Request timeout.
- Domain status changes.
- Local MCP server startup and failure.

Use structured logs with:
- Request ID.
- Device ID.
- Domain ID where appropriate.
- Event type.
- Error code.
- Timestamp.

Never log:
- Access tokens.
- Device credentials.
- Pairing codes.
- Client secrets.
- Private keys.
- Sensitive environment variables.

Add useful health and readiness endpoints.

Do not build a monitoring dashboard.

## 16. Testing Requirements

Use Vitest.

Implement unit and integration tests.

### Protocol tests
- Valid messages.
- Invalid messages.
- Unsupported protocol versions.
- Invalid request IDs.
- Oversized messages.

### Authentication tests
- Valid OneAuth JWT.
- Invalid signature.
- Wrong issuer.
- Wrong audience.
- Expired token.
- Missing scope.
- Revoked device.
- Inactive domain.
- Opaque-token introspection failure.

### Device tests
- Pairing success.
- Expired pairing code.
- Reused pairing code.
- Invalid pairing code.
- Credential rotation.
- Device revocation.

### Relay tests
- Hostname resolution.
- Device lookup.
- WebSocket routing.
- Request correlation.
- Request timeout.
- Device disconnect.
- Stale response rejection.
- Cross-device isolation.

### Agent tests
- WebSocket connection.
- Authentication.
- Heartbeat.
- Reconnection.
- Local process startup.
- STDIO communication.
- Process cleanup.
- MCP error handling.

### End-to-end test

Create a test MCP server exposing a harmless tool:

```text
hello
```

Expected flow:

1. Start the test MCP server locally.
2. Start the Mesh agent.
3. Connect the agent to the relay.
4. Send an MCP tool-list request to the relay.
5. Confirm the relay routes it to the correct device.
6. Confirm the agent forwards it to the local MCP server.
7. Invoke the `hello` tool remotely.
8. Confirm the result reaches the remote client.

Also test what happens when the agent disconnects during a request.

## 17. Deployment Requirements

The relay is intended to run on a free hosting tier initially.

The deployment environment must support:
- Node.js.
- Public HTTPS.
- Custom domains.
- WebSocket upgrade connections.
- Persistent outbound and inbound network connections.
- PostgreSQL connectivity.
- Appropriate request and connection timeouts.

Do not assume that a free hosting provider guarantees always-on WebSocket connections.

Free hosting may:
- Sleep.
- Restart instances.
- Limit connection duration.
- Limit bandwidth.
- Restrict concurrent connections.
- Enforce usage quotas.

Implement reconnection and recovery rather than relying on uninterrupted hosting.

The relay should bind to:

```text
0.0.0.0
```

Use the hosting provider's assigned port.

Configure wildcard DNS:

```text
*.mcp.nishantapps.in
```

to point to the relay.

Configure TLS for the wildcard domain or another supported arrangement.

Do not require Cloudflare Tunnel.

Do not assume a free PostgreSQL service has permanent free storage. Document the selected provider's limits and backup requirements.

## 18. Performance and Resource Management

The platform should be lightweight.

Avoid unnecessary background processes.

Implement:
- Bounded pending-request storage.
- Bounded WebSocket buffers.
- Request timeouts.
- Connection cleanup.
- Process cleanup.
- Efficient message serialization.
- Reuse of authenticated connections.
- Reasonable concurrency limits.

Do not spawn a new local MCP process for every request.

Keep configured MCP processes alive while the agent is running, subject to their lifecycle and failure state.

## 19. Implementation Phases

Build the project in the following order.

### Phase 0 — Repository and Foundation

- Inspect the repository.
- Create the pnpm workspace.
- Configure TypeScript.
- Configure linting and formatting if needed.
- Install the core dependencies.
- Create the package structure.
- Create `.env.example`.
- Add startup scripts.
- Confirm all packages build.

Deliverable: a clean, buildable monorepo.

### Phase 1 — Protocol and Database

- Define shared message types.
- Implement Zod schemas.
- Implement PostgreSQL connection.
- Implement Drizzle schema.
- Create migrations.
- Add device and domain repositories.
- Write tests.

Deliverable: shared protocol and persistent metadata layer.

### Phase 2 — Relay and WebSocket

- Build Fastify server.
- Add health and readiness endpoints.
- Implement WebSocket endpoint.
- Implement authenticated agent registration.
- Implement heartbeat and disconnect handling.
- Implement in-memory connection registry.
- Implement request correlation.
- Add integration tests.

Deliverable: agents can connect and exchange test messages with the relay.

### Phase 3 — Local Agent and MCP Bridge

- Build the agent process.
- Implement device authentication.
- Implement persistent WebSocket connection.
- Implement reconnect logic.
- Implement STDIO process manager.
- Integrate the MCP TypeScript SDK.
- Forward requests to local MCP servers.
- Return responses to the relay.
- Test using a local example MCP server.

Deliverable: local MCP servers can communicate through the relay.

### Phase 4 — Remote MCP Transport

- Implement the official MCP Streamable HTTP transport.
- Connect HTTP requests to the correct device.
- Preserve MCP session and transport semantics.
- Implement initialization and tool discovery.
- Implement tool invocation.
- Implement timeout and disconnect behavior.
- Test using a real MCP client.

Deliverable: a remote MCP client can access a local MCP server through the relay.

### Phase 5 — OneAuth Integration

- Inspect OneAuth discovery metadata.
- Inspect actual OAuth implementation.
- Implement token validation.
- Implement resource metadata.
- Implement scope enforcement.
- Implement domain lookup and provisioning through verified OneAuth APIs.
- Implement domain lifecycle synchronization.
- Test authorization and revocation.

Deliverable: AI clients authenticate through OneAuth and access authorized MCP resources.

Do not mark this phase complete if the implementation uses mocked OneAuth endpoints in production code.

### Phase 6 — Pairing and Device Lifecycle

- Implement pairing-code generation.
- Implement pairing-code validation.
- Implement device credential creation.
- Implement secure credential storage.
- Implement device revocation.
- Implement credential rotation.
- Implement domain association.
- Test pairing and revocation.

Deliverable: users can securely enroll and manage their laptop agents.

### Phase 7 — Reliability and Security

- Add reconnect backoff and jitter.
- Add connection generation handling.
- Add rate limits.
- Add message limits.
- Add authorization checks.
- Add process isolation safeguards.
- Test disconnects and failures.
- Perform a security review.

Deliverable: robust core system.

### Phase 8 — CLI and Documentation

- Implement CLI commands.
- Add configuration management.
- Add setup instructions.
- Document OneAuth integration.
- Document deployment.
- Document MCP client connection configuration.
- Add troubleshooting instructions.

Deliverable: usable developer-facing MCP Mesh release.

## 20. Definition of Done

MCP Mesh is not complete merely because the relay starts.

The first functional release is complete when all of these conditions hold:

- A laptop can enroll as a device.
- The agent can authenticate with its device credential.
- The agent establishes an outbound WSS connection.
- The relay can identify the connected device.
- The agent can start a local MCP server over STDIO.
- The relay exposes a valid MCP Streamable HTTP endpoint.
- A remote MCP client can initialize an MCP session.
- The remote client can list local MCP tools.
- The remote client can invoke an approved local tool.
- The response reaches the remote client correctly.
- OneAuth authorizes the remote client.
- Device and domain authorization are enforced.
- Revoked devices cannot reconnect.
- Inactive domains cannot be accessed.
- Disconnects and timeouts are handled safely.
- Tests cover the important success and failure cases.

## 21. Final Instructions to GitHub Copilot

Act as the lead backend engineer for NishantApps MCP Mesh.

Work in phases, in the order defined above.

At the beginning:

1. Inspect the repository.
2. Report the existing structure.
3. Identify existing reusable code.
4. Identify missing dependencies and infrastructure.
5. Present the Phase 0 implementation plan.

Then implement Phase 0.

After each phase:

- Summarize what was implemented.
- List the files created or modified.
- Explain architectural decisions.
- Run the relevant tests.
- Run TypeScript checks.
- Fix errors before proceeding.
- List anything that requires external configuration.
- Clearly distinguish implemented features from placeholders and mocks.

Do not skip tests.

Do not claim a feature works if it has only been scaffolded.

Do not silently move to the next phase if the current phase has failing tests.

Ask for approval before destructive changes, external account actions, publishing packages, deploying services, or modifying an existing OneAuth production environment.

Keep the implementation focused on the MCP Mesh core.

**Start with repository inspection and Phase 0. Do not attempt to implement the entire platform in one giant code-generation step.**