// @vitest-environment node
/** @file Independent documented syntax expectations and local real-source compilation. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { compileSources, sourceImportPath } from '../src/importing/rpgscript/compile';
import { parseScript } from '../src/importing/rpgscript/parser';
import { emitDeclaration } from '../src/importing/rpgscript/emit';
import { parseSystem } from '../src/importing/system';
import { object } from '../src/domain/model';

const lower = (source: string) => {
  const script = parseScript(source, 'original.rpgs');
  const macros = new Map();
  for (const declaration of script.declarations.filter(d => d.kind === 'define')) macros.set(declaration.name, { declaration });
  return script.declarations.filter(d => d.kind !== 'define').map(d => emitDeclaration(d, macros, { nodes: 0, depth: 0 }));
};
const constant = (value: string | number) => ({ type: 'constant', value, value_type: typeof value === 'number' ? 'integer' : 'string' });

it('lowers documented arithmetic, typed defaults and source annotations without adding defaults', () => {
  expect(lower('@party_visible base resource<note>[] notes(name = "Notes") = [];')[0]).toEqual({
    id: 'notes', name: 'Notes', type: 'base', value_type: 'array', sub_value_type: 'resource', resource_type: 'note', default_value: [], party_visible: true
  });
  expect(object(lower('calc integer total(name="Total") = strength + 2;')[0]).components).toEqual({
    type: 'add', components: { type: 'list', components: [{ type: 'stat', stat: 'strength' }, constant(2)] }
  });
  expect(object(lower('calc string text() = "hello" + name;')[0]).components).toEqual({
    type: 'concat', components: { type: 'list', components: [constant('hello'), { type: 'stat', stat: 'name' }] }
  });
});

it('preserves source component IDs and wraps declared sheet sections and mechanics', () => {
  expect(lower('character_sheet_section outer() = text(id="inner", text="Test", style="text");')[0]).toEqual({
    id: 'outer', view: { type: 'text', id: 'inner', text: constant('Test'), style: 'text' }
  });
  expect(lower('mechanic one(event_names="check") = showMessage(message="Hello");')[0]).toEqual({
    id: 'one', effects: { type: 'showMessage', message: constant('Hello') }, event_names: 'check'
  });
});

it('substitutes macro expressions and string IDs without executing code', () => {
  expect(lower('define label(prefix, value) = text(id="${prefix}_label", text=value, style="text"); view row() = label(prefix="own", value=score);')[0]).toEqual({
    type: 'text', id: 'own_label', text: { type: 'stat', stat: 'score' }, style: 'text'
  });
  expect(() => lower('define loop() = loop(); calc integer x() = loop();')).toThrow('Recursive');
  expect(() => lower('view row() = text(id=score, text="Test", style="text");')).toThrow('literal');
});

it('rejects malformed, unsafe and excessive sources rather than skipping content', () => {
  for (const text of ['calc integer x() = eval("bad");', 'base string x() = "unfinished', '/* unfinished',
    'base string x(name="x", name="y")="";', 'calc integer x() = '+ '('.repeat(70) + '1' + ')'.repeat(70)])
    expect(() => lower(text)).toThrow();
  expect(() => lower('view row() = text(id="x", constructor="bad");')).toThrow();
  expect(sourceImportPath('systems/5e/system/stats.rpgs', '../../_stdlib/math.rpgs')).toBe('systems/_stdlib/math.rpgs');
  for (const input of ['https://evil.test/x.rpgs', '../../../../x.rpgs', '/x.rpgs', '..\\x.rpgs'])
    expect(() => sourceImportPath('systems/a.rpgs', input)).toThrow();
});

function localFiles(directory: string, base = directory): Map<string, string> {
  const result = new Map<string, string>();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) for (const [name, text] of localFiles(path, base)) result.set(name, text);
    else if (/\.(?:rpgs|json)$/.test(entry.name)) result.set(relative(base, path).replaceAll('\\', '/'), readFileSync(path, 'utf8'));
  }
  return result;
}
const reference = resolve('.reference/rpg-companion-app-systems');
it.skipIf(!existsSync(reference)).each(['5e', '5e2024'])('compiles every pinned real %s source without a compiled upload', id => {
  const files = new Map([
    ...localFiles(resolve(reference, `systems/${id}/system`), reference),
    ...localFiles(resolve(reference, 'systems/_stdlib'), reference)
  ]);
  const start = performance.now();
  const compiled = compileSources(files, `systems/${id}/system/system.rpg.json`);
  const parsed = parseSystem(JSON.stringify(compiled));
  expect(parsed.definition.id).toBe(id);
  expect(parsed.definition.character_stats.length).toBeGreaterThan(100);
  expect(parsed.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
  expect(performance.now() - start).toBeLessThan(10000);
});

it.skipIf(!existsSync(reference))('rejects the unmatched PF2e source parenthesis instead of silently dropping trailing damage terms', () => {
  const path = 'systems/pf2e/system/resources/weapon/stats.rpgs';
  const original = readFileSync(resolve(reference, path), 'utf8');
  expect(/else 0\r?\n  \) \+ total_attachment_damage_bonus/.test(original)).toBe(true);
  expect(() => parseScript(original, path)).toThrow(`${path}:928:3`);
});

const probe = resolve('.reference/source-compiler-probe');
it.skipIf(!existsSync(resolve(probe, 'official/probe/system.composed.json')))('matches independently generated official compiler probes', () => {
  const result = compileSources(localFiles(resolve(probe, 'input')), 'probe/system/system.rpg.json');
  expect(result).toEqual(JSON.parse(readFileSync(resolve(probe, 'official/probe/system.composed.json'), 'utf8')));
});

it.skipIf(!existsSync(resolve('.reference/official-releases-2026-11-16/5e-system.rpg'))).each(['5e', '5e2024'])('matches independently published %s formulas, views and mechanics', id => {
  const files = new Map([
    ...localFiles(resolve(reference, `systems/${id}/system`), reference),
    ...localFiles(resolve(reference, 'systems/_stdlib'), reference)
  ]);
  const compiled = object(compileSources(files, `systems/${id}/system/system.rpg.json`));
  const published = JSON.parse(gunzipSync(readFileSync(resolve(`.reference/official-releases-2026-11-16/${id}-system.rpg`))).toString('utf8'));
  const groups = [{ id: 'character', stats: compiled.character_stats, expected: published.character_stats },
    ...(compiled.resources as Record<string, unknown>[]).map(resource => ({
      id: resource.id, stats: resource.stats, expected: published.resources.find((item: Record<string, unknown>) => item.id === resource.id)?.stats
    }))];
  for (const group of groups) for (const stat of group.stats as Record<string, unknown>[]) {
    const expected = group.expected?.find((item: Record<string, unknown>) => item.id === stat.id);
    expect({ components: stat.components, default_value: stat.default_value }, `${group.id}.${stat.id}`).toEqual({
      components: expected?.components, default_value: expected?.default_value
    });
  }
  for (const key of ['character_search_item_view', 'character_sheet_sections', 'character_creation_flow', 'mechanics', 'combat_system'])
    expect(compiled[key], key).toEqual(published[key]);
  for (const resource of compiled.resources as Record<string, unknown>[]) {
    const expected = published.resources.find((item: Record<string, unknown>) => item.id === resource.id);
    for (const key of ['display_view', 'edit_view', 'list_view'])
      expect(resource[key], `${resource.id}.${key}`).toEqual(expected?.[key]);
  }
});
