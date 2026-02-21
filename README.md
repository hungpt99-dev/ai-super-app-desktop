# AI SuperApp Desktop

Open-source Tauri desktop client for [AI SuperApp](https://ai-superapp.com).

## Related Repositories

| Repo | Visibility | Purpose |
|------|-----------|---------|
| `ai-super-app-desktop` | **Public** | **This repo** — open-source Tauri desktop client |
| `ai-super-app-backend` | Private | Go API server |
| `ai-super-app-web` | Private | SaaS web dashboard |

## Tech Stack

- **Tauri 2** + Rust — desktop shell
- **React 18** + TypeScript (strict) — UI renderer
- **Zustand** — state management
- **TailwindCSS** — styling
- **Vite 5** — build tool

## Getting Started

```bash
# Install dependencies
npm install

# Run in development (hot-reload renderer + Tauri)
npm run dev

# Type-check all packages
npm run typecheck

# Run tests
npm test
```

## Project Structure

```
ai-super-app-desktop/
 ├── apps/
 │    └── desktop/          # Tauri app (main process + React renderer)
 │         ├── src-tauri/   # Rust backend (main.rs, computer.rs, memory.rs)
 │         └── src/
 │              ├── core/   # Module manager, permission engine, sandbox
 │              ├── sdk/    # AiSdkProxy — HTTP client for Go backend
 │              └── ui/     # React components, stores, hooks
 ├── packages/
 │    ├── sdk/              # Shared Module SDK types (open-source)
 │    └── shared/           # Shared utilities & types (open-source)
 ├── modules/               # Built-in bot modules
 │    ├── crypto/
 │    └── writing-helper/
 └── docs/
```

## Architecture

```
Desktop UI (React)
  └─► Core (Module Manager + Permission Engine + Sandbox)
        └─► SDK Proxy (AiSdkProxy)
              └─► Backend API (ai-super-app-backend, Go)
```

The desktop app **never calls AI providers directly**. All AI traffic routes through the backend gateway.

## Contributing

See [AGENTS.md](AGENTS.md) for coding standards, architecture rules, and contribution guidelines.

## License

MIT
