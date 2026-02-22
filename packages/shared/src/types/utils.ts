/**
 * Discriminated union Result type — avoids try/catch at call sites.
 * Pattern: Railway-Oriented Programming.
 */
export type Result<T, E extends Error = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E extends Error>(error: E): Result<never, E> {
  return { ok: false, error }
}

/** Wraps a promise and catches errors into a Result. */
export async function tryCatch<T>(
  fn: () => Promise<T>,
): Promise<Result<T, Error>> {
  try {
    return ok(await fn())
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)))
  }
}

/** Assert a value is not null/undefined (narrows type). */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message)
  }
}

/** Semver compatibility check (major.minor.patch). */
export function isSemverCompatible(
  version: string,
  min: string,
  max: string,
): boolean {
  const parse = (v: string): [number, number, number] => {
    const [major = 0, minor = 0, patch = 0] = v
      .replace(/[^0-9.]/g, '')
      .split('.')
      .map(Number)
    return [major, minor, patch]
  }

  const toNum = ([maj, min_, pat]: [number, number, number]): number =>
    maj * 1_000_000 + min_ * 1_000 + pat

  const cur = toNum(parse(version))
  const minN = toNum(parse(min))
  const maxN = max.endsWith('.x')
    ? toNum(parse(max.replace('.x', '.999')))
    : toNum(parse(max))

  return cur >= minN && cur <= maxN
}

/** Deep-freeze an object (prevents mutation of config/constants). */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.keys(obj).forEach((key) => {
    const val = (obj as Record<string, unknown>)[key]
    if (val && typeof val === 'object') {
      deepFreeze(val as object)
    }
  })
  return Object.freeze(obj)
}
