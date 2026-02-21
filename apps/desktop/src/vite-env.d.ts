/* eslint-disable @typescript-eslint/naming-convention */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_URL: string | undefined
  readonly VITE_DEV_TOKEN: string | undefined
  readonly VITE_APP_VERSION: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
/* eslint-enable @typescript-eslint/naming-convention */
