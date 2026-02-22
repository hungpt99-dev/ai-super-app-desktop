import { describe, it, expect } from 'vitest'
import {
  AppError,
  PermissionDeniedError,
  ModuleNotFoundError,
  SignatureVerificationError,
} from './errors.js'

describe('AppError subclasses', () => {
  it('PermissionDeniedError has correct code', () => {
    const e = new PermissionDeniedError('Access denied')
    expect(e.code).toBe('PERMISSION_DENIED')
    expect(e.message).toBe('Access denied')
    expect(e instanceof AppError).toBe(true)
    expect(e instanceof Error).toBe(true)
  })

  it('ModuleNotFoundError serialises to JSON correctly', () => {
    const e = new ModuleNotFoundError('Module missing', { id: 'crypto' })
    expect(e.toJSON()).toEqual({
      code: 'MODULE_NOT_FOUND',
      message: 'Module missing',
      details: { id: 'crypto' },
    })
  })

  it('SignatureVerificationError has correct name', () => {
    const e = new SignatureVerificationError('Bad sig')
    expect(e.name).toBe('SignatureVerificationError')
  })
})
