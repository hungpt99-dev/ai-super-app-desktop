/**
 * IPC module barrel — main process side of the IPC bridge.
 */

export { handleIPCMessage } from './handler.js'
export { executionIPC } from './execution.ipc.js'
export { agentIPC } from './agent.ipc.js'
export { skillIPC } from './skill.ipc.js'
export { snapshotIPC } from './snapshot.ipc.js'
export { filesystemIPC } from './filesystem.ipc.js'
export { planningIPC } from './planning.ipc.js'
export { actingIPC } from './acting.ipc.js'
export { metricsIPC } from './metrics.ipc.js'

