# AgentHub

---

## Overview

AgentHub is a cross-platform AI Agent Operating System, SDK, and Marketplace. It enables developers to build, publish, and distribute modular AI agents with custom logic, UI, and permission control, running on desktop and web clients.

---

## Key Features

- Modular agent runtime engine
- SDK for agent development (Rust & TypeScript)
- Schema-driven UI rendering
- Permission and sandbox enforcement
- Memory abstraction (local & shared)
- Remote control via HTTP/WebSocket
- Agent marketplace for distribution
- Deterministic, persistent orchestration

---

## Architecture

```
Marketplace
   │
Agent Package (.ahpkg)
   │
Agent Runtime Engine
   │
Transport Layer (HTTP/WS)
   │
Desktop Client (Tauri) / Web Client (SPA)
```

---

## Getting Started

1. Build agents using the SDK
2. Define manifest, logic, UI, and permissions
3. Package and publish to marketplace
4. Install and manage agents via desktop/web client

---

## Documentation

- docs/vision.md — Project vision & philosophy
- docs/technical-design.md — Technical architecture
- docs/codebase.md — Codebase structure & rules
- docs/agents.md — Agent specification & lifecycle

---

## License

AgentHub is open-source and welcomes community contributions.

---
