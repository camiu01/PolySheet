/** @file Untrusted import validation and conservative unsupported-feature reporting. */
import { describe, expect, it } from 'vitest';
import { demo, demoOriginal } from '../src/demo';
import { boundedJson, decodeUtf8, parseSystem, prepareSystem } from '../src/importing/system';

describe('monolithic JSON import', () => {
  it('validates the original distributed fixture without compatibility warnings', () => {
    const parsed = parseSystem(demoOriginal);
    expect(parsed.definition.id).toBe('polysheet-sentieri');
    expect(parsed.diagnostics).toEqual([]);
  });
  it('preserves unknown fields and identifies their exact path', () => {
    const parsed = parseSystem(JSON.stringify({ ...demo, future_extension: { secret_rule: 12 } }));
    expect(parsed.definition.future_extension).toEqual({ secret_rule: 12 });
    expect(parsed.diagnostics).toContainEqual(expect.objectContaining({ path: '$.future_extension' }));
  });
  it('reports missing root structure without crashing', () => {
    expect(() => parseSystem('{"id":"x"}')).toThrow('$.character_stats');
    expect(() => parseSystem('{bad')).toThrow('malformato');
  });
  it('names an unassembled split authoring root instead of raw schema noise', () => {
    const authoringRoot = {
      id: '5e', name: '5e', abbreviation: '5e', version: '0.9.1', min_app_version: '1.2.0',
      character_indexed_stats: ['name'], live_session_enabled: true,
      progression_systems: {}, currencies: {}
    };
    expect(() => parseSystem(JSON.stringify(authoringRoot))).toThrow('sorgente di authoring suddivisa');
    expect(() => parseSystem(JSON.stringify({ ...authoringRoot, character_stats: demo.character_stats }))).toThrow('$.character_sheet_sections');
  });
  it('rejects oversized, deep and prototype-bearing documents', () => {
    expect(() => boundedJson('"123456"', 4)).toThrow('grande');
    expect(() => boundedJson('{"__proto__":{"polluted":true}}')).toThrow('vietata');
    expect(() => boundedJson('['.repeat(66) + '0' + ']'.repeat(66))).toThrow('complesso');
  });
  it('diagnoses unknown view types and mechanics', () => {
    const parsed = parseSystem(JSON.stringify({ ...demo,
      mechanics: [{ id: 'unsafe', effects: { type: 'javascript' } }],
      character_sheet_sections: [{ id: 'new', view: { id: 'unknown', type: 'futureView' } }]
    }));
    expect(parsed.diagnostics.some(d => d.path.endsWith('.type') && d.message.includes('futureView'))).toBe(true);
    expect(parsed.diagnostics.some(d => d.path === '$.mechanics')).toBe(true);
  });
  it('flags duplicate IDs, wrong defaults, cycles and unresolved refs', () => {
    const data = structuredClone(demo);
    data.character_stats.push({ ...data.character_stats[0] });
    expect(parseSystem(JSON.stringify(data)).diagnostics.some(d => d.severity === 'error' && d.message.includes('duplicato'))).toBe(true);
    const circular = { ...demo, character_stats: [
      { id: 'a', name: 'A', type: 'calculated', value_type: 'integer', components: { type: 'stat', stat: 'b' } },
      { id: 'b', name: 'B', type: 'calculated', value_type: 'integer', components: { type: 'stat', stat: 'a' } }
    ] };
    expect(parseSystem(JSON.stringify(circular)).diagnostics.some(d => d.severity === 'error' && d.message.includes('circolare'))).toBe(true);
    expect(parseSystem(JSON.stringify({ ...demo, character_stats: [{ id: 'x', name: 'X', type: 'base', value_type: 'integer', default_value: 'wrong' }] })).diagnostics.some(d => d.path.endsWith('default_value'))).toBe(true);
  });
  it('does not silently interpret arrays as formula trees', () => {
    const data = { ...demo, character_stats: [{ id: 'x', name: 'X', type: 'calculated', value_type: 'integer', components: { type: 'add', components: [] } }] };
    expect(parseSystem(JSON.stringify(data)).diagnostics.some(d => d.severity === 'error' && d.path.endsWith('.components'))).toBe(true);
  });
  it('hashes exact source text and protects same-version alternate imports', async () => {
    const first = await prepareSystem(demoOriginal, 'fixture');
    const second = await prepareSystem(demoOriginal + '\n', 'fixture');
    expect(first.definition.version).toBe(second.definition.version);
    expect(first.key).not.toBe(second.key);
    expect(first.original).toBe(demoOriginal);
  });
  it('retains exact UTF-8 including a BOM and rejects malformed byte sequences', async () => {
    const original = '\ufeff' + demoOriginal;
    const decoded = decodeUtf8(new TextEncoder().encode(original));
    expect(decoded).toBe(original);
    expect((await prepareSystem(decoded, 'BOM fixture')).original).toBe(original);
    expect(decodeUtf8(new TextEncoder().encode('È una storia 🏹'))).toBe('È una storia 🏹');
    expect(() => decodeUtf8(Uint8Array.from([0xc3, 0x28]))).toThrow('UTF-8 valida');
  });
});

it('accepts $parent and $resource paths inside a resource scope only', () => {
  const integer = (id: string) => ({ id, name: id, type: 'base', value_type: 'integer', default_value: 0 });
  const calculated = (id: string, path: string) => ({ id, name: id, type: 'calculated', value_type: 'integer',
    components: { type: 'stat', stat: path } });
  const resources = [...demo.resources, { id: 'nested', name: 'Nested', stats: [integer('own'), calculated('owner_level', '$parent.level')],
    list_view: { id: 'nested_list', type: 'list', subviews: [{ id: 'row', type: 'stat', stat: '$resource.own' }] } }];
  const scoped = parseSystem(JSON.stringify({ ...demo, resources })).diagnostics;
  expect(scoped.filter(d => /\$parent|\$resource/.test(d.message))).toEqual([]);
  // A character stat has no parent scope, so the same path stays reported there.
  const character = { ...demo, character_stats: [...demo.character_stats, calculated('parent_level', '$parent.level')] };
  expect(parseSystem(JSON.stringify(character)).diagnostics).toContainEqual(expect.objectContaining({
    message: 'Riferimento mancante o contesto non disponibile: $parent.level' }));
});

it('resolves a stat path that walks the resource held by a base field', () => {
  const stats = (...fields: unknown[]) => ({ ...demo,
    resources: [...demo.resources,
      { id: 'beast', name: 'Beast', stats: [{ id: 'wings', name: 'Wings', type: 'base', value_type: 'integer', default_value: 0 }] },
      { id: 'warden', name: 'Warden', stats: [
        { id: 'beast', name: 'Beast', type: 'base', value_type: 'resource', resource_type: 'beast', default_value: null }],
        list_view: { id: 'warden_list', type: 'list', subviews: fields } }] });
  const view = (field: string) => ({ id: field, type: 'stat', stat: field });
  const resolved = parseSystem(JSON.stringify(stats(view('beast.wings'))));
  expect(resolved.diagnostics.filter(d => /Riferimento non risolto/.test(d.message))).toEqual([]);
  const missing = parseSystem(JSON.stringify(stats(view('beast.horns'))));
  expect(missing.diagnostics).toContainEqual(expect.objectContaining({
    path: `$.resources[${demo.resources.length + 1}].list_view.subviews[0].stat`, message: 'Riferimento non risolto: beast.horns' }));
});

it('reports only the resource mechanics that stay manual', () => {
  const used = { id: 'used', name: 'Used', type: 'base', value_type: 'integer', default_value: 0 };
  const set = (value: unknown) => ({ type: 'setStat', stat: 'used', new_value: value, aggregation_type: 'set' });
  const popup = { type: 'showPopUp', pop_up_title: { type: 'constant', value: 'Scegli' },
    pop_up_view: { id: 'text', type: 'text', text: { type: 'constant', value: 'x' } } };
  const runnable = { id: 'use', event_names: 'use', effects: set({ type: 'constant', value: 1 }) };
  const manual = { id: 'choose', event_names: 'choose', effects: popup };
  const resource = (mechanics: unknown[]) => [...demo.resources, { id: 'gizmo', name: 'Gizmo', stats: [used], mechanics }];
  const path = `$.resources[${demo.resources.length}].mechanics`;
  const partial = parseSystem(JSON.stringify({ ...demo, resources: resource([runnable, manual]) }));
  expect(partial.diagnostics).toContainEqual(expect.objectContaining({ path,
    message: '1 di 2 meccaniche risorsa eseguite; 1 non eseguibili perché richiedono una finestra o input esterni.' }));
  // A mechanic the card can run is executed, so no warning is left behind.
  expect(parseSystem(JSON.stringify({ ...demo, resources: resource([runnable]) })).diagnostics.some(d => d.path === path)).toBe(false);
});

it('accepts resource identity and item-scoped resourceArray labels without unresolved-reference warnings', () => {
  const stat = (id: string) => ({ type: 'stat', stat: id });
  const system = { ...demo, resources: [...demo.resources,
    { id: 'armor', name: 'Armor', stats: [{ id: 'label', name: 'Label', type: 'base', value_type: 'string', default_value: '' }] },
    { id: 'kit', name: 'Kit', stats: [
      { id: 'armors', name: 'Armors', type: 'base', value_type: 'array', sub_value_type: 'resource', default_value: [] },
      { id: 'own_id', name: 'Own id', type: 'calculated', value_type: 'string', components: stat('id') }],
      edit_view: { id: 'kit_edit', type: 'resourceArray', resource_id: 'armor', stat: 'armors', view_type: 'edit', pop_up_button_text: stat('label') } }] };
  const unresolved = parseSystem(JSON.stringify(system)).diagnostics.filter(d => d.message.includes('contesto non disponibile'));
  expect(unresolved).toEqual([]);
  const character = { ...demo, character_stats: [...demo.character_stats, { id: 'own_id', name: 'Own id', type: 'calculated', value_type: 'string', components: stat('id') }] };
  expect(parseSystem(JSON.stringify(character)).diagnostics).toContainEqual(expect.objectContaining({ message: 'Riferimento mancante o contesto non disponibile: id' }));
});
