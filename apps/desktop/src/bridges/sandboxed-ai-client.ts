import type { IAiClient, IAiGenerateRequest, IAiGenerateResponse } from '@agenthub/sdk'
import { Permission } from '@agenthub/sdk'
import type { PermissionEngine } from '@agenthub/core'
import { logger } from '@agenthub/shared'
import { AiSdkProxy } from './ai-sdk-proxy.js'

const log = logger.child('SandboxedAiClient')

/**
 * SandboxedAiClient — Proxy Pattern.
 *
 * Wraps the real AiSdkProxy but enforces permission checks
 * BEFORE forwarding any call. Modules only ever receive this proxy.
 *
 * Performance: AiSdkProxy is now cached as a class field instead of
 * being created on every generate()/stream() call.
 */
export class SandboxedAiClient implements IAiClient {
  private readonly proxy = new AiSdkProxy()

  constructor(
    private readonly moduleId: string,
    private readonly permissionEngine: PermissionEngine,
  ) { }

  async generate(request: IAiGenerateRequest): Promise<IAiGenerateResponse> {
    this.permissionEngine.check(this.moduleId, Permission.AiGenerate)
    log.debug('ai.generate called', { moduleId: this.moduleId, capability: request.capability })
    return this.proxy.generate(request)
  }

  async *stream(request: IAiGenerateRequest): AsyncIterable<string> {
    this.permissionEngine.check(this.moduleId, Permission.AiStream)
    log.debug('ai.stream called', { moduleId: this.moduleId, capability: request.capability })
    yield* this.proxy.stream(request)
  }
}
