# AGENTS.md \u2013 AI SuperApp Desktop

This file defines coding standards, architecture rules, and behavioral guidelines for AI agents working in this repository.

---

## 1. Project Overview

**AI SuperApp Desktop** is the open-source Tauri + React desktop client.  
The private backend lives in a separate repository: `ai-super-app-backend` (Go + Chi).  
The private SaaS web dashboard lives in a separate repository: `ai-super-app-web` (React + Vite).  
Architecture: Desktop Shell \u2192 Go API Gateway \u2192 AI Orchestrator \u2192 Module Ecosystem.

Key docs:
- Product concept: [`docs/product-concept.md`](docs/product-concept.md)
- Technical architecture: [`docs/technical-architecture.md`](docs/technical-architecture.md)

> **This repo is desktop-only and open-source.** Do not add backend or web dashboard code here.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Tauri 2 + Rust |
| UI | React + TypeScript |
| Styling | TailwindCSS |
| Local DB | SQLite (via Tauri plugin) |
| Language | TypeScript (strict mode) |
| Backend (separate repo) | Go + Chi (`ai-super-app-backend`) |
| Web Dashboard (separate repo) | React + Vite (`ai-super-app-web`) |
| Backend DB (separate repo) | PostgreSQL + Redis |

---

## 3. Coding Standards

### 3.1 General

- **TypeScript strict mode** is required — no `any` unless explicitly justified with a comment.
- All files use **ES modules** (`import/export`), never `require()`.
- Prefer `const` over `let`. Never use `var`.
- No magic numbers — extract to named constants.
- No hardcoded strings for user-facing text — use i18n keys.
- No hardcoded colors — use design tokens / Tailwind classes.
- All async functions must use `async/await`. No raw `.then()` chains.

### 3.2 Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | `kebab-case` | `module-manager.ts` |
| Components | `PascalCase` | `ChatWindow.tsx` |
| Functions | `camelCase` | `loadModule()` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_TOKEN_LIMIT` |
| Interfaces | `PascalCase` + `I` prefix | `IModuleContext` |
| Types | `PascalCase` | `UserPlan` |
| Enums | `PascalCase` | `CapabilityType` |

### 3.3 Comments

- **Minimal comments** — code should be self-documenting.
- Only add comments for non-obvious logic or security-sensitive sections.
- Use JSDoc for all exported functions and interfaces.
- No commented-out code in commits.

### 3.4 Error Handling

- Never swallow errors silently. Always log or rethrow.
- Use typed custom error classes, not generic `Error`.
- API responses must use a consistent error envelope:

```typescript
interface ApiError {
  code: string       // e.g. "PERMISSION_DENIED"
  message: string    // human-readable
  details?: unknown  // optional debug info
}
```

---

## 4. Architecture Rules

### 4.1 Module / Layer Boundaries

- **Modules** must never access Node.js APIs directly — only through `ModuleContext` SDK.
- **Desktop layer** must never call AI providers directly — always through Cloud Gateway.
- **UI components** must never contain business logic — delegate to hooks or services.
- **Backend services** must be stateless — state lives in PostgreSQL or Redis.

### 4.2 Security — Non-Negotiable

- Never log JWT tokens, API keys, or user credentials.
- All module packages must be signature-verified before install.
- Permission checks must happen at the SDK proxy layer, not inside modules.
- No `eval()`, `new Function()`, or dynamic `require()` anywhere.
- Rate limiting must be applied on all Cloud API routes.

### 4.3 Module SDK

When implementing or modifying module-related code, always follow the `defineModule` API contract:

```typescript
export default defineModule({
  name: string,
  permissions: Permission[],
  tools: Tool[],
  onActivate(ctx: IModuleContext): void
})
```

Do not introduce module-level network calls outside the `ctx.ai` or `ctx.storage` interfaces.

---

## 5. File & Folder Structure

```
ai-super-app-desktop/        ← this repo (open-source)
 ├── AGENTS.md
 ├── README.md
 ├── docs/
 ├── apps/
 │    └── desktop/          # Tauri + React
 │         ├── src-tauri/   # Rust backend (main.rs, computer.rs, memory.rs)
 │         └── src/
 │              ├── core/   # Module manager, permission engine, sandbox
 │              ├── ui/     # React components, stores, hooks
 │              └── sdk/    # AiSdkProxy — HTTP client for Go backend
 ├── packages/
 │    ├── sdk/              # Shared Module SDK types
 │    └── shared/           # Shared utilities & types
 └── modules/               # Built-in bot modules
      ├── crypto/
      └── writing-helper/

ai-super-app-backend/        ← separate private repo (Go)
 ├── cmd/api/               # API server binary
 ├── cmd/worker/            # Background worker binary
 ├── internal/              # config, auth, orchestrator, billing, ...
 ├── pkg/                   # logger, errors, utils
 └── migrations/

ai-super-app-web/            ← separate private repo (React + Vite)
 ├── src/
 │    ├── pages/            # Route-level page components
 │    ├── components/       # Reusable UI components
 │    ├── store/            # Zustand stores
 │    └── lib/              # API client + demo mode
 └── ...
```

---

## 6. Testing Requirements

- Every new feature must have a corresponding test before implementation (**TDD preferred**).
- Test file lives next to source file: `module-manager.test.ts`.
- Unit tests: **Vitest**.
- E2E tests: **Playwright** (desktop flows).
- Minimum coverage for `core/` and `orchestrator/`: **80%**.
- Security-sensitive code (permission engine, sandbox): **100% coverage required**.

**Testing workflow for agents:**
1. Write the test first.
2. Confirm test fails.
3. Write implementation to make the test pass.
4. Refactor if needed.

---

## 7. Git & PR Guidelines

- Branch naming: `feat/`, `fix/`, `chore/`, `refactor/` prefixes.
- Commits follow **Conventional Commits**: `feat: add permission engine`.
- Each PR should be focused — one concern per PR.
- No PR merges without passing tests and linting.
- Do not commit `.env` files, secrets, or credentials.

---

## 8. What Agents Should NOT Do

- ❌ Do not install new dependencies without noting the reason.
- ❌ Do not modify `packages/sdk/` interfaces without updating all consumers.
- ❌ Do not bypass the permission engine for convenience.
- ❌ Do not use `console.log` in production code — use the structured logger.
- ❌ Do not generate code that calls AI providers directly from the desktop layer.
- ❌ Do not hardcode user plan logic — read from billing service.
- ❌ Do not create new files outside the defined folder structure without justification.

---

## 9. When in Doubt

1. Check `docs/technical-architecture.md` for architectural decisions.
2. Follow the existing patterns in `packages/sdk/` as the source of truth for interfaces.
3. Ask for clarification rather than assuming — especially for security and billing logic.
