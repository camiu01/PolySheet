// @vitest-environment node
/** @file Real 5e race weapons, attunement and source spell preselection, with unchanged originals. */
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { prepareSystem } from '../src/importing/system';
import { prepareCatalogTemplate } from '../src/importing/catalog';
import { configureCharacter, installCatalogs } from '../src/persistence/catalog';
import { installSystem, SheetDatabase } from '../src/persistence/db';
import { createEvaluator, RuntimeResource } from '../src/engine/formulas';
import { resourceFilters, filterResources } from '../src/engine/resource-filters';
import { isResourceReference, object } from '../src/domain/model';

const file = '.reference/official-releases-2026-11-16/5e-system.rpg';
it.skipIf(!existsSync(file))('runs original race weapons and Spells filters using pinned private character resources', async () => {
  const system = await prepareSystem(gunzipSync(readFileSync(file)).toString('utf8'), 'Local-only official 5e resource regression');
  const database = new SheetDatabase(`resource-filters-${crypto.randomUUID()}`);
  try {
    await installSystem(system, database);
    const previews = await Promise.all(['class_fighter_fighter', 'race_human'].map(name => prepareCatalogTemplate(
      readFileSync(`.reference/rpg-companion-app-systems/systems/5e/resource_instances/${name}.rpg.json`, 'utf8'), 'local.json', system)));
    const [classId, raceId] = await installCatalogs(previews, database);
    const character = await configureCharacter(system, 'Resource regression', {}, { classes: classId, race: raceId }, undefined, database);
    const resources = await database.resources.toArray();
    const context = { resources, resourceDefinitions: system.definition.resources,
      character: new RuntimeResource(character.id, system.definition.character_stats, character.values, character.createdAt) };
    const engine = createEvaluator(system.definition.character_stats, character.values, undefined, context);
    const weapons = engine.get('all_weapons');
    expect(Array.isArray(weapons) && weapons.length).toBe(1);
    if (!Array.isArray(weapons) || !isResourceReference(weapons[0])) throw new Error('Expected the original Human unarmed weapon');
    expect(resources.find(r => r.id === weapons[0].resourceId)?.values.name).toBe('Unarmed Strike');
    expect(engine.get('attuned_weapons')).toEqual([]);
    expect(engine.get('attuned_resources')).toEqual([]);
    expect(engine.get('all_weapons')).toEqual(weapons);
    const spell = system.definition.resources.find(r => r.id === 'spell')!;
    const nodes: Record<string, unknown>[] = [];
    function visit(value: unknown) {
      if (!value || typeof value !== 'object') return;
      if (!Array.isArray(value) && object(value).type === 'selectResources' && object(value).resource_id === 'spell') nodes.push(object(value));
      for (const child of Object.values(value)) visit(child);
    }
    visit(system.definition.character_sheet_sections);
    const input = nodes.find(n => n.filters != null)?.filters;
    expect(input).toBeDefined();
    const filters = resourceFilters(input, spell, engine.evaluate);
    expect(filters).toEqual([{ stat: 'classes', name: 'Class', values: ['Fighter'] }]);
    const candidates = ['Fighter', 'Wizard'].map(name => ({
      id: name, name, definitionId: 'spell', systemKey: system.key, values: { classes: [name] }
    }));
    expect(filterResources(candidates, spell, filters, context).map(r => r.name)).toEqual(['Fighter']);
    expect((await database.systems.get(system.key))?.original).toBe(system.original);
    expect(character.values).not.toHaveProperty('all_weapons');
  } finally { await database.delete(); }
}, 20000);
