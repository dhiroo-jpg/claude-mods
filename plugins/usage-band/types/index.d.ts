export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type Meter = { label: string; percent: number; resetsAt?: string }

export type Snapshot = {
  context?: number
  tokens?: number
  window: number
  meters: Meter[]
  costUsd?: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band': {
      snapshot: Snapshot | null
      effortOverride: Effort | null
      lastEffort: Effort | null
      page: number
      now: number
    }
  }
}
