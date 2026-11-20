// @vitest-environment node
/** @file 5e Bard Optional Features: open choices after level up and the unchanged feature card SAVE on the sheet. */
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { prepareSystem } from '../src/importing/system';
import { prepareCatalogTemplate } from '../src/importing/catalog';
import { configureCharacter, installCatalogs } from '../src/persistence/catalog';
import { installSystem, SheetDatabase } from '../src/persistence/db';
import { advanceCharacter } from '../src/persistence/progression';
import { runCharacterEvent } from '../src/persistence/character-events';
import { progressionClasses } from '../src/engine/progression';
import { cardLocalInputs, resourceEventSupported } from '../src/engine/resource-events';

const fixture = '.reference/official-releases-2026-11-16/5e-system.rpg';
const bardFile = '.reference/rpg-companion-app-systems/systems/5e/resource_instances/class_bard_bard.rpg.json';
const view = 'feat_display_selectable_features_select';

it.skipIf(!existsSync(fixture) || !existsSync(bardFile))('lists Bard Optional Features as open only until chosen, in the form or from the sheet card', async () => {
  const system = await prepareSystem(gunzipSync(readFileSync(fixture)).toString('utf8'), 'Local Bard fixture');
  const feat = system.definition.resources.find(resource => resource.id === 'feat')!;
  expect(cardLocalInputs(feat)).toEqual([view]);
  expect(resourceEventSupported(system.definition, 'feat', { name: 'saveSelectableFeaturesChoice' })).toBe(true);
  for (const chooseInForm of [true, false]) {
    const database = new SheetDatabase(`bard-${crypto.randomUUID()}`);
    try {
      await installSystem(system, database);
      const [bard] = await installCatalogs([await prepareCatalogTemplate(readFileSync(bardFile, 'utf8'), 'local.json', system)], database);
      const character = await configureCharacter(system, 'Bard', { constitution_score: 14, hit_point_mode: 'average' },
        { classes: bard }, undefined, database, true);
      const wrapper = progressionClasses(system, character, await database.resources.toArray())[0];
      const advanced = await advanceCharacter(character.id, character.revision, {
        wrapperId: wrapper.record.id, expectedClassLevel: 1, targetLevel: 2, archetypeId: null, acknowledgeChoices: true,
        ...chooseInForm ? { selectableFeatures: [{ featureId: 'bard_optional_features', selected: ['magic_inspiration'] }] } : {}
      }, database);
      expect(advanced.summary.features).toContain('Bard Optional Features');
      expect(advanced.summary.choices).toEqual(chooseInForm ? [] : ['Bard Optional Features']);
      if (chooseInForm) continue;
      const card = (await database.resources.toArray()).find(record => record.definitionId === 'feat'
        && record.name === 'Bard Optional Features' && !record.catalogSource)!;
      // An undeclared view key is refused before anything is written.
      await expect(runCharacterEvent(character.id, { name: 'saveSelectableFeaturesChoice', payload: {} }, database, card.id,
        { other_view: ['magic_inspiration'] })).rejects.toThrow();
      await runCharacterEvent(character.id, { name: 'saveSelectableFeaturesChoice', payload: {} }, database, card.id,
        { [view]: ['magic_inspiration'] });
      const saved = await database.resources.get(wrapper.record.id);
      expect(saved?.values.selected_selectable_feature_ids).toEqual(['magic_inspiration']);
      expect((await database.characters.get(character.id))?.values.selected_selectable_feature_ids ?? []).toEqual([]);
    } finally { await database.delete(); }
  }
}, 120000);
