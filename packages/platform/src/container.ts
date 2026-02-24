import type {
    ICoreStorageAdapter,
    ICoreLLMProvider,
    ICoreSandbox,
    ICoreVectorStore,
} from '@agenthub/core'

export interface IDependencyContainer {
    readonly storage: ICoreStorageAdapter
    readonly provider: ICoreLLMProvider
    readonly sandbox: ICoreSandbox
    readonly vectorStore?: ICoreVectorStore
    readonly secretVault?: unknown
}
