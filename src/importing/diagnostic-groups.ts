/**
 * @file Presentation grouping for import diagnostics.
 * @remarks Grouping never drops, rewrites or downgrades a diagnostic; it only
 * orders the complete array so repeated limits read as one topic.
 */
import type { Diagnostic } from '../domain/model';

export const DIAGNOSTIC_CATEGORIES = ['error', 'mechanics', 'events', 'references', 'unsupported', 'fields', 'other'] as const;
export type DiagnosticCategory = typeof DIAGNOSTIC_CATEGORIES[number];

/**
 * Classify one diagnostic by severity, source path and message family.
 * @returns `error` for every blocking entry; otherwise the feature family that explains the limit.
 */
export function diagnosticCategory(diagnostic: Diagnostic): DiagnosticCategory {
  const { path, message, severity } = diagnostic;
  if (severity === 'error') return 'error';
  if (/(?:^|[._])event$/.test(path) || /^Evento/.test(message)) return 'events';
  if (path.endsWith('.mechanics') || /meccaniche non eseguite|^Effett|^Progressione|^Flusso ufficiale|^Inizializzazione|^Destinazion|^Modalità iniziativa|^roll viene eseguito/.test(message)) return 'mechanics';
  if (/^Riferimento|^Tipo di risorsa non risolto/.test(message)) return 'references';
  if (/non supportat[oaie]|^Supportati solo|^Tipo non modificabile|^Editor liste/.test(message)) return 'unsupported';
  if (/^Campo conservato/.test(message)) return 'fields';
  return 'other';
}

/** Group the complete diagnostic array in a fixed category order, omitting empty groups. */
export function groupDiagnostics(diagnostics: Diagnostic[]): { category: DiagnosticCategory; items: Diagnostic[] }[] {
  const groups = new Map<DiagnosticCategory, Diagnostic[]>();
  for (const diagnostic of diagnostics) {
    const category = diagnosticCategory(diagnostic);
    groups.set(category, [...(groups.get(category) ?? []), diagnostic]);
  }
  return DIAGNOSTIC_CATEGORIES.flatMap(category => groups.has(category) ? [{ category, items: groups.get(category)! }] : []);
}
