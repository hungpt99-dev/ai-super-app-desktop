import { describe, it, expect, beforeEach } from 'vitest'
import { PermissionEngine } from '@agenthub/core'
import { Permission } from '@agenthub/sdk'
import { PermissionDeniedError, ValidationError } from '@agenthub/shared'

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

  // ── New tests for Phase 2 additions ──────────────────────────────────────

  it('revokePermission() removes a single permission', () => {
    engine.grant('module-a', [Permission.AiGenerate, Permission.StorageLocal])
    engine.revokePermission('module-a', Permission.AiGenerate)
    expect(engine.hasPermission('module-a', Permission.AiGenerate)).toBe(false)
    expect(engine.hasPermission('module-a', Permission.StorageLocal)).toBe(true)
  })

  it('getModulePermissions() returns the correct set', () => {
    engine.grant('module-a', [Permission.AiGenerate, Permission.UiNotify])
    const perms = engine.getModulePermissions('module-a')
    expect(perms.has(Permission.AiGenerate)).toBe(true)
    expect(perms.has(Permission.UiNotify)).toBe(true)
    expect(perms.size).toBe(2)
  })

  it('getModulePermissions() returns empty set for unknown module', () => {
    const perms = engine.getModulePermissions('unknown')
    expect(perms.size).toBe(0)
  })

  it('rejects empty moduleId with ValidationError', () => {
    expect(() => engine.grant('', [Permission.AiGenerate])).toThrow(ValidationError)
    expect(() => engine.grant('  ', [Permission.AiGenerate])).toThrow(ValidationError)
  })

  it('skips grant with empty permissions array', () => {
    engine.grant('module-a', [])
    expect(engine.getModulePermissions('module-a').size).toBe(0)
  })
})
