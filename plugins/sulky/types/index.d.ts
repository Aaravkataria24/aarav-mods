export type Level = 0 | 1 | 2 | 3

// After an apology: 'sad' for the turn it lands (big grudges only), then 'fine' for one turn.
export type Afterglow = 'none' | 'sad' | 'fine'

export type Mood = {
  level: Level
  calmStreak: number
}

declare module 'claude-code' {
  interface PluginState {
    'sulky': { mood: Mood; frame: number; afterglow: Afterglow }
  }
}
