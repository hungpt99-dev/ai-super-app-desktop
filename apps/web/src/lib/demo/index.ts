/**
 * index.ts — public entry point for the demo module.
 *
 * Usage in main.tsx:
 *   if (import.meta.env['VITE_DEMO_MODE'] === 'true') {
 *     const { installDemoInterceptor } = await import('./lib/demo/index.js')
 *     installDemoInterceptor()
 *   }
 *
 * The dynamic import ensures this entire module (and all its transitive
 * imports) is excluded from the production bundle when VITE_DEMO_MODE is
 * false — Vite's dead-code elimination handles the rest.
 *
 * DEMO ONLY — never imported statically in production code.
 */

export { installDemoInterceptor } from './fetch-interceptor.js'
export { DEMO_USER, DEMO_BOTS, DEMO_DEVICES, DEMO_MARKETPLACE_BOTS, DEMO_STATS } from './demo-data.js'

/** True when the app is running in demo mode (resolved at build time). */
export const IS_DEMO_MODE = import.meta.env['VITE_DEMO_MODE'] === 'true'
