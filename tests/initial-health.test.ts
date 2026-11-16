// @vitest-environment node
/** @file First-level health uses real classes, source-compatible bases and atomic creation. */
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { prepareSystem } from '../src/importing/system';
import { prepareCatalogTemplate } from '../src/importing/catalog';
import { configureCharacter, installCatalogs } from '../src/persistence/catalog';
import { installSystem, SheetDatabase } from '../src/persistence/db';
import { initialHealth, supportsInitialHealth } from '../src/engine/initial-health';
import { createEvaluator, RuntimeResource } from '../src/engine/formulas';

for (const edition of ['5e', '5e2024']) {
  const official = `.reference/official-releases-2026-11-16/${edition}-system.rpg`;
  it.skipIf(!existsSync(official))(`${edition}: initializes real first-level classes across Constitution modifiers without double counting`, async () => {
    const system = await prepareSystem(gunzipSync(readFileSync(official)).toString('utf8'), 'Local-only official health fixture');
    const database = new SheetDatabase(`health-${crypto.randomUUID()}`);
    try {
      await installSystem(system, database);
      expect(supportsInitialHealth(system.definition)).toBe(true);
      const classes = edition === '5e'
        ? [['fighter', 10], ['wizard', 6], ['barbarian', 12], ['cleric', 8]] as const
        : [['wizard', 6], ['barbarian', 12], ['cleric', 8]] as const;
      for (const [name, die] of classes) {
        const original = readFileSync(`.reference/rpg-companion-app-systems/systems/${edition}/resource_instances/class_${name}_${name}.rpg.json`, 'utf8');
        const [id] = await installCatalogs([await prepareCatalogTemplate(original, 'local.json', system)], database);
        const saved = await configureCharacter(system, name, { constitution_score: 14, base_hp: 99, current_hp: 77 },
          { classes: id }, undefined, database, true);
        expect(saved.values.current_hp).toBe(die + 2);
        const resources = await database.resources.where('systemKey').equals(system.key).toArray();
        for (const score of [3, 8, 10, 14, 20]) {
          const draft = { ...saved, values: { ...saved.values, constitution_score: score, base_hp: 99, current_hp: 77 } };
          const patch = initialHealth(system, draft, resources);
          const character = { ...draft, values: { ...draft.values, ...patch } };
          const expected = die + Math.floor((score - 10) / 2);
          expect(character.values.current_hp).toBe(expected);
          const evaluator = createEvaluator(system.definition.character_stats, character.values, undefined, {
            resources, resourceDefinitions: system.definition.resources, enumerations: system.definition.enumerated_types,
            character: new RuntimeResource(character.id, system.definition.character_stats, character.values, character.createdAt)
          });
          expect(evaluator.get('max_hp')).toBe(expected);
          expect(evaluator.get('level')).toBe(1);
          expect(initialHealth(system, character, resources)).toEqual({ base_hp: character.values.base_hp, current_hp: expected });
          if (edition === '5e') expect(character.values.base_hp).toBe(die + Math.min(0, Math.floor((score - 10) / 2)));
          await expect(configureCharacter(system, name, {}, {}, character.id, database, true)).rejects.toThrow('solo ai nuovi');
          expect(await database.characters.get(character.id)).toEqual(saved);
          const advanced = resources.map(record => record.definitionId === 'class_details'
            ? { ...record, values: { ...record.values, class_level: 2 } } : record);
          expect(() => initialHealth(system, character, advanced)).toThrow();
        }
        expect((await database.resources.get(id))?.catalogSource?.original).toBe(original);
      }
      const before = { characters: await database.characters.toArray(), resources: await database.resources.toArray() };
      await expect(configureCharacter(system, 'Missing class', {}, {}, undefined, database, true)).rejects.toThrow();
      await expect(configureCharacter(system, 'Invalid health', { constitution_score: -100 }, {
        classes: before.resources.find(record => record.definitionId === 'class' && record.catalogSource)!.id
      }, undefined, database, true)).rejects.toThrow();
      expect(await database.characters.toArray()).toEqual(before.characters);
      expect(await database.resources.toArray()).toEqual(before.resources);
    } finally { await database.delete(); }
  }, 20000);
}
