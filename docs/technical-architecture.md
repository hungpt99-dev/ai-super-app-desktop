## Model: Web UI + Desktop Execution + Community Mini-App Ecosystem (BYOK)

---

# 1. Architecture Overview

## 1.1 Core Principles

1. Web = Presentation layer only
2. Desktop = Execution authority
3. Cloud = Stateless relay
4. AI keys = Stored locally only
5. Mini-Apps = Sandbox executed
6. Community contributions = Signed + permission-based

---

## 1.2 System Topology

```
┌──────────────────────┐
│     Web Client       │
│  (Next.js Frontend)  │
└──────────┬───────────┘
           │ HTTPS + WSS
           ▼
┌──────────────────────┐
│   Cloud Relay API    │
│  Auth + Routing Only │
└──────────┬───────────┘
           │ Secure WebSocket Tunnel
           ▼
┌──────────────────────┐
│   Desktop Runtime    │
│  (Execution Engine)  │
└──────────┬───────────┘
           │ HTTPS
           ▼
┌──────────────────────┐
│    AI Providers      │
└──────────────────────┘
```

---

# 2. Component Architecture

---

# 2.1 Web Layer (Presentation Runtime)

## Responsibilities

- Render Mini-App UI
- User authentication
- Workspace management
- Marketplace browsing
- Install requests
- Action dispatch
- Streaming display

## Does NOT

- Execute Mini-App logic
- Access AI keys
- Execute tools

---

## 2.1.1 Internal Modules

### App Shell

- Navigation
- Sidebar
- Device status
- Subscription display

### Mini-App UI Renderer

- Parses `ui-schema.json`
- Dynamically builds UI components
- Client-side validation

### Action Dispatcher

Sends structured message:

```json
{
  "type": "EXECUTE_ACTION",
  "requestId": "uuid",
  "deviceId": "device-123",
  "appId": "seo-writer",
  "action": "generate",
  "payload": {}
}
```

### Streaming Handler

Receives:

- STREAM_CHUNK
- STREAM_END
- ERROR

---

# 2.2 Cloud Layer (Relay + Control Plane)

Cloud is stateless execution-wise.

---

## 2.2.1 Services

### 1️⃣ Auth Service

- JWT validation
- OAuth login
- Session management

### 2️⃣ Device Registry

Stores:

```
device_id
user_id
status
connection_id
last_seen
version
```

### 3️⃣ WebSocket Gateway

- Routes Web → Desktop
- Routes Desktop → Web
- Enforces ownership
- Enforces subscription limits

### 4️⃣ Marketplace Service

- Mini-App metadata
- Version management
- Ratings
- Download URLs

### 5️⃣ Developer Portal Service

- Mini-App submission
- Static code scan
- Signature generation

---

## 2.2.2 Infrastructure

- Node.js (Fastify)
- Redis (Pub/Sub + device map)
- PostgreSQL (metadata storage)
- Object Storage (Mini-App bundles)
- Load Balancer
- Containerized deployment

---

# 3. Desktop Runtime Architecture

Desktop is the execution core.

---

# 3.1 Runtime Layers

```
Desktop Runtime
 ├── Connection Manager
 ├── Execution Engine
 ├── Mini-App Manager
 ├── AI Adapter Layer
 ├── Tool Registry
 ├── Permission Manager
 ├── Sandbox Environment
 └── Secure Storage
```

---

# 3.2 Connection Manager

- Persistent WebSocket
- Auto-reconnect
- Heartbeat
- Device authentication token

---

# 3.3 Mini-App Manager

Responsibilities:

- Install Mini-App
- Verify signature
- Extract bundle
- Maintain version registry
- Enable/disable apps
- Register each Mini-App's dedicated **Bot Worker** with the Bot registry

Local structure:

```
~/aisuperapp/
  miniapps/
    seo-writer/
      v1.0.0/
        bot-logic.js
        tools.js
```

---

## 3.3.1 Bot Worker Model

Every installed Mini-App is backed by a dedicated **Bot Worker** running on the Desktop Agent. The Web UI never executes logic directly — it dispatches a structured JSON task to the bot and polls for the result.

```
Web UI (Control Tower)
  │  botsApi.start(botId, inputJSON)
  │
  ▼
Cloud Relay API
  │  run queued
  │
  ▼
Desktop Agent — Bot Worker (per Mini-App)
  │  executes task: tools, AI calls, data fetch
  │  botsApi.updateRun(runId, 'completed', steps, resultJSON)
  │
  ▼
Cloud Relay API
  │  run.status = 'completed'
  │
  ▼
Web UI (polls botsApi.getRuns)
  └─ parse run.result → render in Mini-App panel
```

### Dispatch protocol

1. Web calls `POST /v1/bots/{botId}/runs` with body `{ input: string }` (JSON-stringified task)
2. Desktop Agent Bot Worker claims the run from the queue
3. Worker executes the Mini-App task (tool calls, AI inference, external API)
4. Worker posts result via `PUT /v1/bots/{botId}/runs/{runId}` with `{ status: 'completed', result: string }`
5. Web polls `GET /v1/bots/{botId}/runs` (every 1.5 s, timeout 15 s)
6. Web JSON-parses `run.result` and renders it in the Mini-App panel

### Input/output contracts per built-in Mini-App

| Mini-App | Bot input type | Bot output shape |
|---|---|---|
| Crypto Tracker | `{ type: 'get_market_data', symbol: string }` | `IMarketData` |
| Writing Helper | `{ type: 'process_writing', text, action, tone, targetLanguage? }` | `{ result: string; tokensUsed: number }` |
| Generic | `{ type: 'run', instruction: string }` | `{ output: string }` |

### Fallback behaviour

If the Desktop Agent is offline or the bot run times out, the Web UI degrades gracefully:
- **Crypto Tracker** → falls back to CoinGecko public API, then static demo prices
- **Writing Helper** → falls back to local template-based text transformation
- A `WorkerBadge` in each panel header shows `🤖 Bot Worker` or `💻 Local` to inform the user

---

# 3.4 Execution Engine

The Desktop Agent's Execution Engine hosts and runs Bot Workers — one per installed Mini-App.

### Bot Worker lifecycle

1. Mini-App is installed → a Bot entity is created and registered
2. Desktop Agent starts → all active Mini-App bots are brought online
3. Web dispatches a run → Bot Worker picks it up from the Cloud Relay queue
4. Worker spawns a sandboxed Worker Thread for the task
5. Worker executes (tool calls, AI inference, external data fetch)
6. Worker posts result back to Cloud Relay
7. Web receives result via polling
8. Worker Thread is terminated after the run

### Legacy EXECUTE_ACTION flow (still supported)

1. Receive EXECUTE_ACTION
2. Validate device ownership
3. Load Mini-App module
4. Spawn sandbox worker
5. Inject runtime context
6. Execute action
7. Stream output
8. Terminate worker

---

# 3.5 Sandbox Architecture

Mini-App code never runs in main process.

## Execution Model

Each action:

- Runs in isolated Worker Thread
- Memory cap
- Execution timeout
- No direct Node global access

---

## Injected Runtime Context

```tsx
{
  ai: AIAdapter,
  tools: ToolRegistry,
  storage: SafeLocalStorage,
  console: SafeConsole,
  env: SafeEnv
}
```

Not exposed:

- require
- process
- child_process
- direct fs
- network modules

---

# 3.6 AI Adapter Layer

Abstract interface:

```tsx
interface AIProvider {
  generateText(prompt, options): AsyncGenerator<string>
}
```

Supported:

- OpenAI
- Anthropic
- Google
- Future local LLM

AI keys:

- Stored encrypted
- OS keychain preferred
- Never exposed to Mini-App

Mini-App calls:

```tsx
context.ai.generateText()
```

Not direct API calls.

---

# 3.7 Tool Registry

Tools are controlled modules.

Examples:

- FileReadTool
- FileWriteTool
- HTTPTool
- CSVParser
- PDFParser

Mini-App cannot access system directly.

Must use:

```tsx
context.tools.file.read()
```

Permission checked before execution.

---

# 3.8 Permission Model

Each Mini-App declares:

```json
{
  "fileSystem": {
    "read": true,
    "write": false
  },
  "network": false,
  "clipboard": false
}
```

Install flow:

1. Desktop shows permission list
2. User approves
3. Stored locally
4. Enforced per execution

---

# 4. Mini-App Package Specification

---

# 4.1 File Format

Extension:

```
.aisapp
```

Structure:

```
manifest.json
ui-schema.json
action-schema.json
bot-logic.js
tools.js
permissions.json
signature.sig
```

---

# 4.2 Code Signing

Process:

1. Developer uploads source
2. Platform builds bundle
3. Static analysis scan
4. Platform signs bundle (private key)
5. Publish

Desktop:

- Verifies signature (public key)
- Rejects if invalid

---

# 5. Communication Protocol

---

# 5.1 Message Envelope

All messages use unified envelope:

```json
{
  "type": "EVENT_TYPE",
  "requestId": "uuid",
  "deviceId": "device-id",
  "payload": {}
}
```

---

# 5.2 Event Types

Web → Desktop:

- EXECUTE_ACTION
- INSTALL_APP
- UNINSTALL_APP
- GET_STATUS

Desktop → Web:

- STREAM_CHUNK
- STREAM_END
- ERROR
- DEVICE_STATUS

---

# 6. Security Architecture

---

# 6.1 Threat Model

### 1️⃣ Malicious Mini-App

Mitigation:

- Sandbox
- Permission system
- Code signing

### 2️⃣ Cloud compromise

Mitigation:

- No AI keys stored
- Stateless relay

### 3️⃣ Man-in-the-middle

Mitigation:

- TLS
- Optional payload encryption

### 4️⃣ Unauthorized execution

Mitigation:

- Device-user binding
- JWT validation
- Subscription check

---

# 6.2 Key Storage

Desktop:

- OS Keychain
- AES fallback encryption
- No plaintext file storage

---

# 7. Database Schema (Cloud)

---

## Users

```
id
email
password_hash
created_at
subscription_status
```

## Devices

```
id
user_id
status
last_seen
version
```

## MiniApps

```
id
name
developer_id
latest_version
category
rating
```

## MiniAppVersions

```
id
miniapp_id
version
bundle_url
checksum
created_at
```

---

# 8. Deployment Architecture

---

## Cloud

- Docker containers
- NGINX ingress
- Horizontal scaling
- Redis cluster
- PostgreSQL managed

---

## Desktop

- Signed installer
- Auto-update mechanism
- Backward-compatible protocol

---

# 9. Observability

---

## Cloud Monitoring

- Active devices
- Execution requests
- Error rate
- Marketplace installs

## Desktop Logging

- Local logs
- Crash reporting (opt-in)
- Mini-App execution time

---

# 10. Scalability Strategy

Cloud:

- Stateless WebSocket nodes
- Redis for routing
- Load-balanced horizontally

Desktop:

- Scales per user
- No AI compute load on cloud

AI cost risk = zero.

---

# 11. Versioning Strategy

- Semantic versioning for Mini-App
- Backward-compatible message protocol
- Web and Desktop version independent
- Runtime compatibility matrix

---

# 12. Future Extensions

- Local LLM support
- Cloud fallback execution
- Enterprise on-prem relay
- Team shared runtime
- Automation workflow builder
- Advanced Mini-App monetization

---

# 13. Architectural Summary

AI SuperApp is:

A distributed AI platform where:

- Web handles UI
- Cloud handles routing
- Desktop handles execution
- AI provider handles compute
- Community handles innovation

The system is:

- Secure by design
- Cost-efficient
- Ecosystem-driven
- Scalable
- Enterprise-ready foundation