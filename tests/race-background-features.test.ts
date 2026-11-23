// @vitest-environment node
/** @file 5e race traits and background features read `$character.level` from the sheet that owns them. */
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { createEvaluator } from '../src/engine/formulas';
import { prepareSystem } from '../src/importing/system';
import { prepareCatalogTemplate } from '../src/importing/catalog';
import { configureCharacter, installCatalogs } from '../src/persistence/catalog';
import { installSystem, SheetDatabase } from '../src/persistence/db';

const release = '.reference/official-releases-2026-11-16/5e-system.rpg';
const folder = '.reference/rpg-companion-app-systems/systems/5e/resource_instances/';
const files = ['class_bard_bard', 'race_elf_elf', 'background_entertainer'].map(name => `${folder}${name}.rpg.json`);

it.skipIf(!existsSync(release) || files.some(file => !existsSync(file)))('lists the traits of the race and background on the sheet', async () => {
  const real = await prepareSystem(gunzipSync(readFileSync(release)).toString('utf8'), 'Local features fixture');
  const database = new SheetDatabase(`features-${crypto.randomUUID()}`);
  try {
    await installSystem(real, database);
    const [bard, elf, entertainer] = await installCatalogs(await Promise.all(files.map(file =>
      prepareCatalogTemplate(readFileSync(file, 'utf8'), 'local.json', real))), database);
    const created = await configureCharacter(real, 'Traits', { hit_point_mode: 'average' },
      { classes: bard, race: elf, background: entertainer }, undefined, database, true);
    const character = (await database.characters.get(created.id))!;
    const sheet = createEvaluator(real.definition.character_stats, character.values, undefined, {
      resources: await database.resources.toArray(), resourceDefinitions: real.definition.resources,
      enumerations: real.definition.enumerated_types });
    const names = (id: string) => sheet.evaluate({ type: 'map', components: { type: 'stat', stat: id },
      mapper: { type: 'stat', stat: '$mapValue.name' } }) as string[];
    expect(names('race_traits')).toEqual(expect.arrayContaining(['Darkvision (60 ft.)']));
    expect(names('race_traits')).toHaveLength(4);
    expect(names('background_features')).toEqual(['By Popular Demand']);
  } finally { await database.delete(); }
}, 120000);
