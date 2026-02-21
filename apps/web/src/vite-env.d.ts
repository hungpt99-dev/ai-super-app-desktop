/**
 * vite-env.d.ts — Augments Vite's ImportMetaEnv with project-specific
 * environment variables so TypeScript knows their exact types.
 *
 * All VITE_ prefixed variables are strings at runtime (sourced from .env
 * files). We type them as `string | undefined` so the compiler enforces
 * proper null-coalescing where a fallback is needed.
 */

/* eslint-disable @typescript-eslint/naming-convention */
interface ImportMetaEnv {
  readonly VITE_GATEWAY_URL: string | undefined
  readonly VITE_DEMO_MODE: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
/* eslint-enable @typescript-eslint/naming-convention */
