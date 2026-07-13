/**
 * passes/index.ts
 * Public API for the passes package.
 */
export { resourceMergePass } from './resource-merge.js';
export { paginationDetectionPass } from './pagination-detection.js';
export { searchDetectionPass } from './search-detection.js';
export { booleanDetectionPass } from './boolean-detection.js';
export { collectionDetectionPass } from './collection-detection.js';
export { dangerousCommandDetectionPass } from './dangerous-command-detection.js';
export { complexityDetectionPass } from './complexity-detection.js';
export { confidenceConsolidationPass } from './confidence-consolidation.js';
export { DEFAULT_PASS_CONFIG } from './types.js';
export type { PassConfig, Pass } from './types.js';
