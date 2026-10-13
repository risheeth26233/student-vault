// GuruGraph — deterministic identifier helpers.
// Every id is a pure function of its input so re-running intelligence over the
// same Student-Vault data always produces byte-identical records.

/** FNV-1a 32-bit hash rendered as 8 fixed-width hex chars. */
export function hash32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Lowercase ASCII slug. Empty/unsupported input yields ''. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Stable subject id derived from the raw subject name.
 * Case and whitespace differences collapse to the same id ("Math" === "math"),
 * while the hash suffix keeps visually different names apart ("A+B" vs "A B").
 */
export function subjectIdFromLabel(label: string): string {
  const normalized = label.trim().replace(/\s+/g, ' ');
  const slug = slugify(normalized) || 'unnamed';
  return `sub_${slug}_${hash32(normalized.toLowerCase())}`;
}

/** Concepts are derived from Student-Vault topics (no invented concept data). */
export function conceptIdFromTopic(topicId: string): string {
  return `concept_topic_${topicId}`;
}

/** One signal per source record, so ids stay unique and traceable. */
export function signalId(kind: string, sourceId: string): string {
  return `${kind}:${sourceId}`;
}

export interface MasteryScope {
  topicId?: string | null;
  conceptId?: string | null;
}

/** Scope key for a mastery record: subject alone, subject+topic or subject+concept. */
export function masteryRecordKey(subjectId: string, scope: MasteryScope = {}): string {
  if (scope.conceptId) return `${subjectId}::${scope.conceptId}`;
  if (scope.topicId) return `${subjectId}::topic:${scope.topicId}`;
  return `${subjectId}::subject`;
}

export function gapRecordId(ruleId: string, scopeKey: string): string {
  return `${ruleId}::${scopeKey}`;
}

export function relationshipId(fromConceptId: string, toConceptId: string, kind: string): string {
  return `${fromConceptId}->${toConceptId}#${kind}`;
}
