export type Buzz = {
  shots: number
  // Prompts of hangover left after sobering up; 0 when not hungover.
  hangover: number
}

declare module 'claude-code' {
  interface PluginState {
    'drunk': { buzz: Buzz; frame: number }
  }
}
