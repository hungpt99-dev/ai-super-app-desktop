import { describe, it, expect } from 'vitest'
import { ok, err, tryCatch, isSemverCompatible, assertDefined } from './utils.js'

describe('Result helpers', () => {
  it('ok() creates a success result', () => {
    const result = ok(42)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe(42)
  })

  it('err() creates an error result', () => {
    const result = err(new Error('oops'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('oops')
  })

  it('tryCatch wraps a resolved promise', async () => {
    const result = await tryCatch(() => Promise.resolve('hello'))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('hello')
  })

  it('tryCatch wraps a rejected promise', async () => {
    const result = await tryCatch(() => Promise.reject(new Error('fail')))
    expect(result.ok).toBe(false)
  })
})

describe('assertDefined', () => {
  it('does not throw for defined value', () => {
    expect(() => assertDefined('value', 'msg')).not.toThrow()
  })

  it('throws for null', () => {
    expect(() => assertDefined(null, 'was null')).toThrow('was null')
  })

  it('throws for undefined', () => {
    expect(() => assertDefined(undefined, 'was undefined')).toThrow('was undefined')
  })
})

describe('isSemverCompatible', () => {
  it('returns true for compatible version', () => {
    expect(isSemverCompatible('1.2.0', '1.0.0', '2.x')).toBe(true)
  })

  it('returns false when version below min', () => {
    expect(isSemverCompatible('0.9.0', '1.0.0', '2.x')).toBe(false)
  })

  it('returns false when version above max', () => {
    expect(isSemverCompatible('3.0.0', '1.0.0', '2.x')).toBe(false)
  })
})
