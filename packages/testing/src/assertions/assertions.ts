/**
 * Test assertions — structured assertion helpers for agent test scenarios.
 */

export interface IAssertionResult {
    readonly passed: boolean
    readonly assertionName: string
    readonly message: string
    readonly expected?: unknown
    readonly actual?: unknown
}

export function assertEqual(name: string, expected: unknown, actual: unknown): IAssertionResult {
    const expectedStr = JSON.stringify(expected)
    const actualStr = JSON.stringify(actual)
    const passed = expectedStr === actualStr

    return {
        passed,
        assertionName: name,
        message: passed
            ? `Assertion "${name}" passed`
            : `Assertion "${name}" failed: expected ${expectedStr}, got ${actualStr}`,
        expected,
        actual,
    }
}

export function assertContains(name: string, haystack: string, needle: string): IAssertionResult {
    const passed = haystack.includes(needle)

    return {
        passed,
        assertionName: name,
        message: passed
            ? `Assertion "${name}" passed: output contains "${needle}"`
            : `Assertion "${name}" failed: output does not contain "${needle}"`,
        expected: needle,
        actual: haystack,
    }
}

export function assertTokenUsage(
    name: string,
    actualTokens: number,
    maxTokens: number,
): IAssertionResult {
    const passed = actualTokens <= maxTokens

    return {
        passed,
        assertionName: name,
        message: passed
            ? `Assertion "${name}" passed: ${actualTokens} tokens <= ${maxTokens} limit`
            : `Assertion "${name}" failed: ${actualTokens} tokens > ${maxTokens} limit`,
        expected: maxTokens,
        actual: actualTokens,
    }
}

export function assertLatency(
    name: string,
    actualMs: number,
    maxMs: number,
): IAssertionResult {
    const passed = actualMs <= maxMs

    return {
        passed,
        assertionName: name,
        message: passed
            ? `Assertion "${name}" passed: ${actualMs}ms <= ${maxMs}ms limit`
            : `Assertion "${name}" failed: ${actualMs}ms > ${maxMs}ms limit`,
        expected: maxMs,
        actual: actualMs,
    }
}

export function assertNoError(name: string, error?: string): IAssertionResult {
    const passed = !error

    return {
        passed,
        assertionName: name,
        message: passed
            ? `Assertion "${name}" passed: no error`
            : `Assertion "${name}" failed: error occurred: ${error}`,
        expected: undefined,
        actual: error,
    }
}

export function assertSnapshotMatch(
    name: string,
    matched: boolean,
    diff?: string,
): IAssertionResult {
    return {
        passed: matched,
        assertionName: name,
        message: matched
            ? `Assertion "${name}" passed: snapshot matches`
            : `Assertion "${name}" failed: snapshot mismatch\n${diff ?? ''}`,
    }
}
