/**
 * passes/types.ts
 *
 * Shared types for all passes.
 * Every pass is a pure function: (sir: SIR, config: PassConfig) => SIR
 */
import type { SIR } from '@asc/core-sir';

export interface PassConfig {
  /** Global confidence threshold. Fields below this go to review. Default: 0.6 */
  confidenceThreshold: number;
  /** Per-pass threshold overrides. Key = pass name. */
  passThresholds: Record<string, number>;
  /** Whether to emit verbose debug info in diagnostics. Default: false */
  debug: boolean;
}

export const DEFAULT_PASS_CONFIG: PassConfig = {
  confidenceThreshold: 0.6,
  passThresholds: {},
  debug: false,
};

export type Pass = (sir: SIR, config: PassConfig) => SIR;

/** Get the effective confidence threshold for a named pass. */
export function getThreshold(passName: string, config: PassConfig): number {
  return config.passThresholds[passName] ?? config.confidenceThreshold;
}
