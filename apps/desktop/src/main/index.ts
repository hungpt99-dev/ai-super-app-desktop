/**
 * Desktop main process barrel.
 *
 * The main process owns:
 *   - PlatformHost (composition root)
 *   - RuntimeHost (lifecycle management)
 *   - IPC handler (message routing to/from renderer)
 *
 * The renderer process imports ONLY from @agenthub/sdk, @agenthub/contracts,
 * and its own UI layer. It communicates with main via IPC.
 */

export { PlatformHost, platformHost } from './platform-host.js'
export { RuntimeHost, runtimeHost } from './runtime-host.js'
export { handleIPCMessage } from './ipc/index.js'
