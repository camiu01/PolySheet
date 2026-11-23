/** @file Source `sort_options`: enumeration order, option-resource labels, booleans and direction. */
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ResourceDefinition, ResourceInstance } from '../src/domain/model';
import { sortOptions, sortResources } from '../src/engine/resource-sort';

const record = (id: string, name: string, values: Record<string, unknown>, definitionId = 'spell'): ResourceInstance =>
  ({ id, systemKey: 'k', definitionId, name, values: { name, ...values }, createdAt: '2026-01-01T00:00:00.000Z' } as unknown as ResourceInstance);
const base = (id: string, value_type = 'string') => ({ id, name: id === 'level' ? 'Level' : id, type: 'base', value_type });
const not = (name: string) => `Not ${name}`;

// Shapes copied from the official 5e source: spell `by level` on enum `spell_level`, monster `by source`
// on resource `source` shown by `abbreviation`.
const spellLevel = { id: 'spell_level', types: [
  { id: 'spell_level_0', name: 'Cantrip' }, { id: 'spell_level_1', name: 'Level 1' }, { id: 'spell_level_2', name: 'Level 2' }] };
const spell = { id: 'spell', name: 'Spell', stats: [base('name'), base('level'), base('ritual', 'bool'), base('tags', 'array')],
  sort_options: [{ name: 'by level', stat: 'level', options: 'spell_level' }, { name: 'alphabetically', stat: 'name' }] } as unknown as ResourceDefinition;
const source = { id: 'source', name: 'Source', stats: [base('abbreviation')] } as unknown as ResourceDefinition;
const monster = { id: 'monster', name: 'Monster', stats: [base('name'), base('source')],
  sort_options: [{ name: 'by source', stat: 'source', options: 'source', options_display_stat: 'abbreviation' }] } as unknown as ResourceDefinition;

describe('sort_options', () => {
  const spells = [record('a', 'Shield', { level: 'spell_level_1' }), record('b', 'Light', { level: 'spell_level_0' }),
    record('c', 'Alarm', { level: 'spell_level_1' }), record('d', 'Untyped', { level: null })];
  const environment = { enumerations: [spellLevel] };

  it('orders by enumeration declaration, groups under entry names and keeps valueless records last', () => {
    const [byLevel] = sortOptions(spell, [spellLevel]);
    const sorted = sortResources(spells, spell, byLevel, environment, not);
    expect(sorted.map(s => s.record.name)).toEqual(['Light', 'Alarm', 'Shield', 'Untyped']);
    expect(sorted.map(s => s.group)).toEqual(['Cantrip', 'Level 1', 'Level 1', null]);
  });

  it('reverses ranked records for order desc and still keeps valueless ones last', () => {
    const desc = { ...spell, sort_options: [{ name: 'by level', stat: 'level', options: 'spell_level', order: 'desc' }] } as unknown as ResourceDefinition;
    const sorted = sortResources(spells, desc, sortOptions(desc, [spellLevel])[0], environment, not);
    expect(sorted.map(s => s.record.name)).toEqual(['Alarm', 'Shield', 'Light', 'Untyped']);
  });

  it('sorts a plain string stat alphabetically without headers, and null means the default by name', () => {
    const [, alphabetical] = sortOptions(spell, [spellLevel]);
    expect(sortResources(spells, spell, alphabetical, environment, not).map(s => [s.record.name, s.group]))
      .toEqual([['Alarm', null], ['Light', null], ['Shield', null], ['Untyped', null]]);
    expect(sortResources(spells, spell, null, environment, not).map(s => s.record.name)).toEqual(['Alarm', 'Light', 'Shield', 'Untyped']);
  });

  it('labels option-resource values by their display stat, matching local copies by source id', () => {
    const sources = [record('mm-local', 'Monster Manual', { abbreviation: 'MM' }, 'source'), record('vgm', 'Volo', { abbreviation: 'VGM' }, 'source')];
    sources[0].sourceId = 'mm';
    const monsters = [record('m1', 'Kobold', { source: 'vgm' }, 'monster'), record('m2', 'Goblin', { source: 'mm' }, 'monster')];
    const sorted = sortResources(monsters, monster, sortOptions(monster)[0],
      { resources: sources, resourceDefinitions: [source, monster] }, not);
    expect(sorted.map(s => [s.record.name, s.group])).toEqual([['Goblin', 'MM'], ['Kobold', 'VGM']]);
  });

  it('uses true_name and false_name for booleans, defaulting to the stat name and its negation', () => {
    const named = { ...spell, sort_options: [{ name: 'ritual', stat: 'ritual', true_name: 'Rituals' }] } as unknown as ResourceDefinition;
    const sorted = sortResources([record('x', 'Bless', { ritual: false }), record('y', 'Alarm', { ritual: true })], named,
      sortOptions(named)[0], {}, not);
    expect(sorted.map(s => [s.record.name, s.group])).toEqual([['Alarm', 'Rituals'], ['Bless', 'Not ritual']]);
  });

  it('rejects options it cannot honour instead of guessing an order', () => {
    const invalid = (option: unknown) => ({ ...spell, sort_options: [option] } as unknown as ResourceDefinition);
    expect(() => sortOptions(invalid({ name: 'tags', stat: 'tags' }))).toThrow('array');
    expect(() => sortOptions(invalid({ name: 'x', stat: 'missing' }))).toThrow('missing');
    expect(() => sortOptions(invalid({ name: 'x', stat: 'level', options: 'unknown_enum' }), [spellLevel])).toThrow('unknown_enum');
    expect(() => sortOptions(invalid({ name: 'x', stat: 'level', order: 'random' }))).toThrow('random');
  });
});

const release = resolve('.reference/official-releases-2026-11-16/5e-system.rpg');
it.skipIf(!existsSync(release))('reads the real 5e spell options in source order', () => {
  const system = JSON.parse(gunzipSync(readFileSync(release)).toString('utf8'));
  const real = system.resources.find((r: { id: string }) => r.id === 'spell');
  expect(sortOptions(real, system.enumerated_types).map(o => [o.name, o.enumeration ?? null]))
    .toEqual([['by level', 'spell_level'], ['alphabetically', null]]);
});
