/** @file 5e bard Jack of All Trades on a real restored character (local-only backup fixture). */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { SheetDatabase } from '../src/persistence/db';
import { restoreBackup } from '../src/persistence/backup';
import { createEvaluator } from '../src/engine/formulas';
import { resolveCharacterOverrides } from '../src/engine/overrides';

const backup = resolve('.reference/lucien-valcourt-backup.json');
const database = new SheetDatabase(`jack-${crypto.randomUUID()}`);
afterAll(() => database.delete());

// 5e character_stats.rpgs: each skill adds proficiency, double for expertise, otherwise
// `has_jack_of_all_trades -> divide([proficiency_bonus, 2], rounding_method = "down")`.
const skills: Record<string, string> = {
  acrobatics: 'dexterity', animal_handling: 'wisdom', arcana: 'intelligence', athletics: 'strength',
  deception: 'charisma', history: 'intelligence', insight: 'wisdom', intimidation: 'charisma',
  investigation: 'intelligence', medicine: 'wisdom', nature: 'intelligence', perception: 'wisdom',
  performance: 'charisma', persuasion: 'charisma', religion: 'intelligence', sleight_of_hand: 'dexterity',
  stealth: 'dexterity', survival: 'wisdom'
};

it.skipIf(!existsSync(backup))('adds half proficiency, rounded down, to every skill without proficiency', async () => {
  await restoreBackup(readFileSync(backup, 'utf8'), database);
  const character = (await database.characters.toArray()).find(c => c.name === 'Lucien Valcourt')!;
  const system = (await database.systems.get(character.systemKey))!;
  const resources = await database.resources.where('systemKey').equals(system.key).toArray();
  const overrides = resolveCharacterOverrides(character.overrides);
  const sheet = createEvaluator(system.definition.character_stats, character.values, undefined, {
    resources, resourceDefinitions: system.definition.resources, enumerations: system.definition.enumerated_types,
    createdAt: character.createdAt, overrides: overrides.values, modifiers: overrides.modifiers
  });
  expect(sheet.get('has_jack_of_all_trades')).toBe(true);
  const proficiency = sheet.get('proficiency_bonus') as number;
  expect(Number.isInteger(proficiency)).toBe(true);
  const kinds = new Set<string>();
  for (const [skill, ability] of Object.entries(skills)) {
    const level = sheet.get(`${skill}_proficiency`) as string;
    kinds.add(level);
    const bonus = level === 'expert' ? 2 * proficiency : level === 'proficient' ? proficiency : Math.floor(proficiency / 2);
    expect([skill, sheet.get(skill)]).toEqual([skill, (sheet.get(`${ability}_modifier`) as number) + bonus]);
  }
  // The fixture exercises the Jack of All Trades branch, not only proficient skills.
  expect(kinds.has('none')).toBe(true);
}, 60000); // Restoring the 25 MB backup takes several seconds under the full suite.
