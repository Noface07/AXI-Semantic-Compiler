/**
 * core-sir/version.ts
 *
 * Single source of truth for the SIR schema version.
 * Backends declare which SIR version they target.
 * Breaking SIR changes → major version bump here → backends updated.
 */
export const SIR_SCHEMA_VERSION = '0.1.0' as const;
export type SIRSchemaVersion = typeof SIR_SCHEMA_VERSION;
