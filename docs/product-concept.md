## Version: 1.0

## Model: Web UI + Desktop Execution + Bot Marketplace (BYOK – Bring Your Own Key)

---

# 1. Executive Summary

AI SuperApp is a **Web-based AI control platform** where:

- The **Web App provides UI only**
- The **Desktop App executes all AI logic**
- Users store their own AI API keys locally
- The Cloud acts only as a secure relay

The system enables users to:

- Run powerful AI Bots
- Control their AI from anywhere via web
- Maintain full privacy and ownership
- Avoid SaaS AI markup costs

Positioning:

> “Your personal AI server, accessible from anywhere.”
> 

---

# 2. Problem Statement

Current AI usage models have limitations:

### 1️⃣ Messaging Bot Platforms (e.g., Zalo bots)

- Limited UI
- Limited extensibility
- No advanced workflows
- Platform dependency

### 2️⃣ AI SaaS Platforms

- Charge markup on AI tokens
- Store user data
- No local execution
- Limited customization

### 3️⃣ Pure Desktop AI Apps

- Not accessible remotely
- No centralized UI
- No marketplace

There is no platform that combines:

- Rich Web UI
- Local AI execution
- BYOK model
- Bot ecosystem where developers build and sell bots
- Remote access

AI SuperApp fills this gap.

---

# 3. Vision

Create a distributed AI application platform where:

- Web = Control Surface
- Desktop = Execution Engine
- AI Providers = Compute Layer

Users own:

- Their keys
- Their runtime
- Their data

We own:

- Platform
- Ecosystem
- Marketplace
- UX

---

# 4. System Architecture

## 4.1 High-Level Architecture

```
User Browser
      |
      v
AI SuperApp Web (UI Layer)
      |
      v
Secure Cloud Relay (Message Router Only)
      |
      v
User Desktop Agent (Execution Engine)
      |
      v
AI Provider (User API Key)
```

---

## 4.2 Architectural Principles

1. Web never executes AI.
2. AI keys are never stored in cloud.
3. Desktop handles all logic.
4. Cloud only routes encrypted messages.
5. Bot UI and Bot Worker logic are separated.

---

# 5. Core Components

---

## 5.1 Web Application (UI Layer Only)

### Responsibilities

- Render Bot UI
- Handle authentication
- Send structured actions to Bot Workers
- Display streaming results
- Show bot history and logs
- Manage device pairing
- Browse and install bots from the Bot Marketplace

### Does NOT:

- Store API keys
- Execute AI prompts
- Run business logic
- Access local files

Tech stack (suggested):

- React / Next.js
- WebSocket client
- Component registry
- JWT authentication

---

## 5.2 Cloud Relay Server

Minimal responsibilities:

- Authentication validation
- Device registry
- WebSocket routing
- Session management
- Subscription check
- Rate limiting

Cloud does NOT:

- Store AI keys
- Process AI prompts
- Execute Bot logic

Optional:

End-to-end encrypted payloads.

---

## 5.3 Desktop Agent (Execution Engine)

The core of the system.

### Responsibilities:

- Store AI API keys (encrypted locally)
- Execute Bot logic
- Call AI providers
- Execute tools
- Access local files (with permission)
- Maintain secure WebSocket connection
- Stream responses to Web

The desktop becomes:

> A personal AI runtime server.
> 

Tech stack (suggested):

- Tauri (lightweight)
- Node.js runtime
- Secure local key storage
- Plugin-based tool system

---

# 6. Bot Framework

Bots are modular AI workers available in the Bot Marketplace. Developers build and publish bots; users install them on their devices. Each Bot is a **UI Panel + Bot Worker** pair:

- **UI Panel** — rendered by the Web Control Tower (React component)
- **Bot Worker** — executed by the Desktop Agent; handles AI calls, tool execution, and data fetching

The Web UI dispatches a structured JSON task to the Bot Worker and polls for the result. The Desktop Agent never exposes AI keys to the Web layer.

Examples:

- SEO Writer
- Content Generator
- Code Assistant
- Crypto Tracker
- Writing Helper

---

## 6.1 Bot Structure

```
bot/
 ├── manifest.json       # name, slug, version, permissions
 ├── ui-schema.json      # Web UI layout definition
 ├── action-schema.json  # bot task input/output contracts
 ├── bot-logic.ts        # Bot Worker implementation (runs on Desktop)
 ├── tools.ts            # Tool definitions used by the bot
 └── permissions.json    # declared capabilities
```

---

## 6.2 Separation of Concerns

- UI Schema → Rendered by Web (React panel component)
- Bot Worker → Runs on Desktop Agent (Bot Worker Thread)
- AI Calls → Executed by Desktop Agent only
- Tools → Executed locally inside the sandbox
- Results → Posted to Cloud Relay, polled by Web UI

---

## 6.3 Permission Model

Bot must declare:

- File system access
- Network access
- Clipboard access
- Local storage access

User must approve.

---

# 7. Execution Flow

### Example: "Fetch BTC market data" (Crypto Tracker Bot)

1. User opens the Crypto Tracker Bot on the Web Control Tower.
2. Web renders the Crypto Panel UI.
3. Web locates the Crypto Tracker Bot Worker (`findBotForApp`).
4. Web calls `botsApi.start(botId, JSON.stringify({ type: 'get_market_data', symbol: 'BTC' }))`.
5. Cloud Relay queues the run.
6. Desktop Agent's Crypto Tracker Bot Worker picks up the run.
7. Worker fetches live price data and AI analysis using its tools.
8. Worker posts `{ status: 'completed', result: IMarketDataJSON }` back to the relay.
9. Web polls `botsApi.getRuns(botId)` every 1.5 s (timeout 15 s).
10. Web JSON-parses `run.result` and renders the price panel.

If the Desktop Agent is offline, the Web panel falls back to direct CoinGecko API calls.

Web never touches AI keys or calls AI providers directly.

---

# 8. Security Model

## 8.1 AI Key Handling

- Stored only on Desktop
- Encrypted at rest
- Never uploaded

## 8.2 Communication Security

- TLS encrypted WebSocket
- Device-based authentication
- Optional end-to-end encrypted payloads

## 8.3 Zero AI Liability

Company does not pay for:

- AI tokens
- API usage
- Model costs

User pays AI provider directly.

---

# 9. Monetization Model

Because AI runs on user machine, revenue comes from platform value.

---

## 9.1 Subscription (Core Revenue)

Pro Plan:

- Remote access to desktop
- Advanced automation
- Scheduling
- Usage analytics
- Multi-device management

---

## 9.2 Bot Marketplace

Developers build and publish Bots. Users install them on their devices — each bot runs automatically, processes data, and renders its own UI on the Web Control Tower.

Revenue model:

- 70% Developer
- 30% Platform

Developer workflow:

1. Build a Bot (UI Panel + Bot Worker)
2. Submit to Bot Marketplace
3. Set price (free or paid)
4. Users install bot on their device
5. Bot runs automatically and shows results in Web UI

---

## 9.3 Team Features (Future)

- Shared bot execution across team devices
- Shared desktop runtime
- Role permissions

---

## 9.4 Enterprise License (Future)

- Private relay server
- On-prem deployment
- SSO integration

---

# 10. Competitive Positioning

Not a chatbot like ChatGPT

Not a messaging bot like Zalo bots

Not a pure desktop app

Closest conceptual comparison:

- TeamViewer (remote execution concept)
- Visual Studio Code Remote Server model

But specialized for AI applications.

---

# 11. Target Users (Phase 1)

1. AI power users
2. Marketers
3. Indie founders
4. Developers
5. AI tool builders

---

# 12. MVP Scope (v1)

Keep extremely focused.

Build only:

- Web UI shell
- Device pairing
- Secure relay
- Desktop runtime
- 2–3 Bots
- Basic subscription gate

Do NOT build:

- Marketplace
- Team collaboration
- Workflow builder
- Cloud runtime
- Mobile app

---

# 13. Product Advantages

✅ No AI cost risk

✅ Strong privacy story

✅ Low infrastructure cost

✅ High scalability

✅ Unique positioning

✅ Hard to replicate

---

# 14. Risks & Mitigation

### Risk 1: Desktop must stay online

Mitigation:

- Encourage lightweight runtime
- Add auto-reconnect
- Add background mode

### Risk 2: User setup friction

Mitigation:

- One-click installer
- QR pairing
- Auto configuration wizard

### Risk 3: Performance

Mitigation:

- Streaming responses
- Local caching
- Efficient prompt design

---

# 15. Roadmap

### Phase 1 – MVP (0–3 months)

- Core architecture
- 2–3 built-in Bots (Crypto Tracker, Writing Helper)
- Basic auth
- Desktop agent
- Bot Marketplace (browse + install)

### Phase 2 – Platform (3–6 months)

- Bot SDK for third-party developers
- Developer portal + Bot submission pipeline
- Usage analytics
- Scheduling
- Bot revenue sharing

### Phase 3 – Ecosystem (6–12 months)

- Marketplace
- Team collaboration
- Enterprise version

---

# 16. Long-Term Vision

AI SuperApp becomes:

> The operating system for personal AI workflows.
> 

Where:

- Users control their own AI runtime.
- Developers build and sell Bots in the Marketplace.
- The platform owns the ecosystem.