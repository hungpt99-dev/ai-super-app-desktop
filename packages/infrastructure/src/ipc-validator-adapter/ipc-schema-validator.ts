/**
 * IPCSchemaValidator — validates IPC payloads against registered schemas.
 *
 * Implements IIPCSchemaValidatorPort from core SecurityDomain.
 * All IPC inputs are validated before processing.
 */

import type { SecurityDomain } from '@agenthub/core'

type IIPCSchemaValidatorPort = SecurityDomain.IIPCSchemaValidatorPort
type IIPCSchemaRule = SecurityDomain.IIPCSchemaRule
type IIPCValidationResult = SecurityDomain.IIPCValidationResult

export class IPCSchemaValidator implements IIPCSchemaValidatorPort {
    private readonly schemas: Map<string, IIPCSchemaRule> = new Map()

    validate(channel: string, payload: unknown): IIPCValidationResult {
        const rule = this.schemas.get(channel)

        if (!rule) {
            return {
                valid: true,
                errors: [],
                channel,
            }
        }

        const errors: string[] = []

        if (typeof payload !== 'object' || payload === null) {
            return {
                valid: false,
                errors: [`Payload must be an object for channel "${channel}"`],
                channel,
            }
        }

        const payloadObj = payload as Record<string, unknown>

        for (const requiredField of rule.required) {
            if (!(requiredField in payloadObj) || payloadObj[requiredField] === undefined) {
                errors.push(`Missing required field "${requiredField}" for channel "${channel}"`)
            }
        }

        for (const [field, expectedType] of Object.entries(rule.payloadSchema)) {
            if (field in payloadObj) {
                const actualType = typeof payloadObj[field]
                if (actualType !== expectedType && expectedType !== 'any') {
                    errors.push(
                        `Field "${field}" expected type "${String(expectedType)}" but got "${actualType}" for channel "${channel}"`,
                    )
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            channel,
        }
    }

    registerSchema(rule: IIPCSchemaRule): void {
        this.schemas.set(rule.channel, rule)
    }

    removeSchema(channel: string): void {
        this.schemas.delete(channel)
    }

    listSchemas(): readonly IIPCSchemaRule[] {
        return [...this.schemas.values()]
    }
}
