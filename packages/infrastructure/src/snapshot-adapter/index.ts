import type { RuntimeDomain } from '@agenthub/core'

type ISnapshotPort = RuntimeDomain.ISnapshotPort
type ISnapshotContent = RuntimeDomain.ISnapshotContent

export class SnapshotAdapter implements ISnapshotPort {
    private readonly _snapshots = new Map<string, ISnapshotContent>()

    async save(snapshot: ISnapshotContent): Promise<void> {
        this._snapshots.set(snapshot.executionId, snapshot)
    }

    async load(executionId: string): Promise<ISnapshotContent | null> {
        return this._snapshots.get(executionId) ?? null
    }

    async list(agentId: string): Promise<readonly ISnapshotContent[]> {
        const results: ISnapshotContent[] = []
        for (const snap of this._snapshots.values()) {
            if (snap.agentId === agentId) {
                results.push(snap)
            }
        }
        return results
    }

    async delete(executionId: string): Promise<void> {
        this._snapshots.delete(executionId)
    }
}
