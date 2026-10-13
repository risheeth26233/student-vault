// GuruGraph — learning intelligence foundation.
// Public boundary for the Phase 2 foundation. Import from here (or from
// `src/types/gurugraph` for types only) instead of reaching into submodules.

export * from './domain';
export * from './signals';
export * from './intelligence';
export * from './service';
export { useGuruGraphIntelligence } from './integration/useGuruGraphIntelligence';
export type {
  GuruGraphDataSummary,
  GuruGraphIntelligenceResult,
  UseGuruGraphIntelligenceOptions,
} from './integration/useGuruGraphIntelligence';
