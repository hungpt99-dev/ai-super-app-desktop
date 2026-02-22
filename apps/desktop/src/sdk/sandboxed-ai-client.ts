import type { IAiClient, IAiGenerateRequest, IAiGenerateResponse } from '@agenthub/sdk'
import { Permission } from '@agenthub/sdk'
import type { PermissionEngine } from '../core/permission-engine.js'
import { logger } from '@agenthub/shared'
import { AiSdkProxy } from './ai-sdk-proxy.js'

const log = logger.child('SandboxedAiClient')

/**
 * SandboxedAiClient — Proxy Pattern.
 *
 * Wraps the real AiSdkProxy but enforces permission checks
 * BEFORE forwarding any call. Modules only ever receive this proxy.
 */
export class SandboxedAiClient implements IAiClient {
  constructor(
    private readonly moduleId: string,
    private readonly permissionEngine: PermissionEngine,
  ) {}

  async generate(request: IAiGenerateRequest): Promise<IAiGenerateResponse> {
    this.permissionEngine.check(this.moduleId, Permission.AiGenerate)
    const proxy = new AiSdkProxy()
    log.debug('ai.generate called', { moduleId: this.moduleId, capability: request.capability })
    return proxy.generate(request)
  }

  async *stream(request: IAiGenerateRequest): AsyncIterable<string> {
    this.permissionEngine.check(this.moduleId, Permission.AiStream)
    const proxy = new AiSdkProxy()
    log.debug('ai.stream called', { moduleId: this.moduleId, capability: request.capability })
    yield* proxy.stream(request)
  }
}
