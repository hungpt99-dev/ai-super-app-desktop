/**
 * SnapshotComparator — compares execution output against golden snapshots.
 *
 * Used for deterministic replay and regression testing.
 */

export interface IGoldenSnapshot {
    readonly id: string
    readonly agentId: string
    readonly name: string
    readonly expectedOutput: unknown
    readonly expectedTokenUsage: {
        readonly promptTokens: number
        readonly completionTokens: number
    }
    readonly metadata?: Readonly<Record<string, unknown>>
    readonly createdAt: string
}

export interface ISnapshotComparisonResult {
    readonly matched: boolean
    readonly diff?: string
    readonly expectedOutput: unknown
    readonly actualOutput: unknown
}

export class SnapshotComparator {
    private readonly snapshots: Map<string, IGoldenSnapshot> = new Map()

    addGoldenSnapshot(snapshot: IGoldenSnapshot): void {
        this.snapshots.set(snapshot.id, snapshot)
    }

    getGoldenSnapshot(snapshotId: string): IGoldenSnapshot | null {
        return this.snapshots.get(snapshotId) ?? null
    }

    listGoldenSnapshots(agentId?: string): readonly IGoldenSnapshot[] {
        const all = [...this.snapshots.values()]
        if (agentId) {
            return all.filter(s => s.agentId === agentId)
        }
        return all
    }

    compare(snapshotId: string, actualOutput: unknown): ISnapshotComparisonResult {
        const golden = this.snapshots.get(snapshotId)
        if (!golden) {
            return {
                matched: false,
                diff: `Golden snapshot "${snapshotId}" not found`,
                expectedOutput: null,
                actualOutput,
            }
        }

        const expectedStr = JSON.stringify(golden.expectedOutput, null, 2)
        const actualStr = JSON.stringify(actualOutput, null, 2)

        if (expectedStr === actualStr) {
            return {
                matched: true,
                expectedOutput: golden.expectedOutput,
                actualOutput,
            }
        }

        const diff = this.computeDiff(expectedStr, actualStr)

        return {
            matched: false,
            diff,
            expectedOutput: golden.expectedOutput,
            actualOutput,
        }
    }

    private computeDiff(expected: string, actual: string): string {
        const expectedLines = expected.split('\n')
        const actualLines = actual.split('\n')
        const diffLines: string[] = []

        const maxLen = Math.max(expectedLines.length, actualLines.length)

        for (let i = 0; i < maxLen; i++) {
            const expectedLine = expectedLines[i]
            const actualLine = actualLines[i]

            if (expectedLine === actualLine) {
                diffLines.push(`  ${expectedLine ?? ''}`)
            } else {
                if (expectedLine !== undefined) {
                    diffLines.push(`- ${expectedLine}`)
                }
                if (actualLine !== undefined) {
                    diffLines.push(`+ ${actualLine}`)
                }
            }
        }

        return diffLines.join('\n')
    }

    removeGoldenSnapshot(snapshotId: string): void {
        this.snapshots.delete(snapshotId)
    }

    clearAll(): void {
        this.snapshots.clear()
    }
}
