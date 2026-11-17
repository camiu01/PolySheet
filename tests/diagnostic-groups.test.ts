/** @file Diagnostic grouping keeps every entry and separates blocking errors from feature limits. */
import { expect, it } from 'vitest';
import { diagnosticCategory, groupDiagnostics } from '../src/importing/diagnostic-groups';
import { parseSystem } from '../src/importing/system';
import { demo } from '../src/demo';
import type { Diagnostic } from '../src/domain/model';

const warning = (path: string, message: string): Diagnostic => ({ path, message, severity: 'warning' });

it('classifies diagnostics by severity, event path and message family', () => {
  expect(diagnosticCategory({ path: '$.x', message: 'Campo conservato, ma non interpretato in questo incremento.', severity: 'error' })).toBe('error');
  expect(diagnosticCategory(warning('$.character_sheet_sections[2].view.content[0].on_tap_event', 'Campo conservato, ma non interpretato in questo incremento.'))).toBe('events');
  expect(diagnosticCategory(warning('$.resources[1].display_view.subviews[7].event', 'Evento del pulsante non eseguito da PolySheet.'))).toBe('events');
  expect(diagnosticCategory(warning('$.currencies', 'Campo conservato, ma non interpretato in questo incremento.'))).toBe('fields');
  expect(diagnosticCategory(warning('$.mechanics', '21 meccaniche non eseguite: il sistema non è pienamente utilizzabile.'))).toBe('mechanics');
  expect(diagnosticCategory(warning('$.mechanics', '21 meccaniche dichiarate. Supporto parziale agli eventi espliciti.'))).toBe('mechanics');
  expect(diagnosticCategory(warning('$.progression_systems', 'Progressione automatica non supportata.'))).toBe('mechanics');
  expect(diagnosticCategory(warning('$.resources[4].stats[65].components.stat', 'Riferimento mancante o contesto non disponibile: $parent.level'))).toBe('references');
  expect(diagnosticCategory(warning('$.resources[11].stats[28].components.type', 'Formula non supportata: eventName'))).toBe('unsupported');
  expect(diagnosticCategory(warning('$.dice', 'Definizioni dadi assenti nella variante storica.'))).toBe('other');
});

it('groups in a fixed order without dropping or duplicating entries', () => {
  const diagnostics = [
    warning('$.macros', 'Campo conservato, ma non interpretato in questo incremento.'),
    { path: '$.character_stats[0].components.order', message: 'Ordine sortBy richiesto: asc o desc.', severity: 'error' as const },
    warning('$.mechanics', '2 meccaniche non eseguite: il sistema non è pienamente utilizzabile.'),
    warning('$.currencies', 'Campo conservato, ma non interpretato in questo incremento.')
  ];
  const groups = groupDiagnostics(diagnostics);
  expect(groups.map(group => group.category)).toEqual(['error', 'mechanics', 'fields']);
  expect(groups.flatMap(group => group.items)).toHaveLength(diagnostics.length);
  expect(groups[2].items.map(item => item.path)).toEqual(['$.macros', '$.currencies']);
  expect(groupDiagnostics([])).toEqual([]);
});

it('covers every diagnostic of a parsed system exactly once', () => {
  const parsed = parseSystem(JSON.stringify({ ...demo, future_field: true, mechanics: [{ id: 'm' }] }));
  const grouped = groupDiagnostics(parsed.diagnostics).flatMap(group => group.items);
  expect(grouped).toHaveLength(parsed.diagnostics.length);
  expect(new Set(grouped)).toEqual(new Set(parsed.diagnostics));
});
