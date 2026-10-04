export type ClackSettings = {
  switch: string
  // 0 to 1.
  volume: number
  isMuted: boolean
  isHidden: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'clack': { settings: ClackSettings; tick: number; isHelperUp: boolean }
  }
}
