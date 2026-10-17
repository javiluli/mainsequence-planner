import type { MachineState } from '../lib/production-analysis'

/** Canvas LEDs and their HTML hints share one stable palette and vocabulary. */
export const machineStatus = {
  ready: { color: '#4ade80', label: 'Inputs ready' },
  'wrong-item': { color: '#ef4444', label: 'Incompatible item' },
  'missing-input': { color: '#f4b055', label: 'Missing ingredient' },
  shortfall: { color: '#c084fc', label: 'Insufficient quantity' },
  unknown: { color: '#71818a', label: 'Not determined' },
} satisfies Record<MachineState, { color: string; label: string }>
