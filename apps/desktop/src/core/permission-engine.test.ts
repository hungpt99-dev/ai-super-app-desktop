import { describe, it, expect, beforeEach } from 'vitest'
import { PermissionEngine } from './permission-engine.js'
import { Permission } from '@agenthub/sdk'
import { PermissionDeniedError } from '@agenthub/shared'

describe('PermissionEngine', () => {
  let engine: PermissionEngine

  beforeEach(() => {
    engine = new PermissionEngine()
  })

  it('grants and checks permission correctly', () => {
    engine.grant('module-a', [Permission.AiGenerate])
    expect(() => { engine.check('module-a', Permission.AiGenerate) }).not.toThrow()
  })

  it('throws PermissionDeniedError for missing permission', () => {
    engine.grant('module-a', [Permission.StorageLocal])
    expect(() => { engine.check('module-a', Permission.AiGenerate) }).toThrow(
      PermissionDeniedError,
    )
  })

  it('returns false for unknown module', () => {
    expect(engine.hasPermission('unknown', Permission.AiGenerate)).toBe(false)
  })

  it('revokes all permissions on revoke()', () => {
    engine.grant('module-a', [Permission.AiGenerate, Permission.StorageLocal])
    engine.revoke('module-a')
    expect(engine.hasPermission('module-a', Permission.AiGenerate)).toBe(false)
  })

  it('accumulates permissions across multiple grant() calls', () => {
    engine.grant('module-a', [Permission.AiGenerate])
    engine.grant('module-a', [Permission.StorageLocal])
    expect(engine.hasPermission('module-a', Permission.AiGenerate)).toBe(true)
    expect(engine.hasPermission('module-a', Permission.StorageLocal)).toBe(true)
  })

  it('isolates permissions between modules', () => {
    engine.grant('module-a', [Permission.AiGenerate])
    expect(engine.hasPermission('module-b', Permission.AiGenerate)).toBe(false)
  })
})
