# AgentHub Agents Overview

---

## What is an Agent?

An Agent in AgentHub is a digital worker designed to perform tasks, automate workflows, and interact with users or systems. Agents are:
- Modular
- Permissioned
- Composable
- Marketplace-ready

---

## Agent Lifecycle

1. Installed
2. Initialized
3. Running
4. Waiting
5. Completed
6. Error

The runtime manages agent state transitions.

---

## Agent Manifest Example

```json
{
  "name": "SEO Agent",
  "version": "1.0.0",
  "entry": "logic.ts",
  "ui": "ui_schema.json",
  "permissions": ["filesystem.read", "http.request"],
  "tools": ["search", "write_file"]
}
```

---

## Agent Types Supported

- Task Agent (one-shot)
- Background Agent (daemon)
- Event-driven Agent
- Orchestrator Agent

---

## Agent Package Structure (.ahpkg)

```
my-agent/
  manifest.json
  prompt.yaml
  logic.ts
  ui_schema.json
  permissions.json
```

---

## Agent Security & Permissions

Agents declare permissions in their manifest. Runtime enforces strict permission checks before tool execution.

---

## Agent Marketplace

Agents can be published, distributed, and installed via the AgentHub marketplace. All packages are signature-verified for trust and safety.

---

## Agent Development

Developers can build agents using the AgentHub SDK (Rust or TypeScript), define custom logic, UI, and permissions, and publish to the marketplace.

---
