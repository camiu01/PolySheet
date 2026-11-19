// @vitest-environment node
/** @file Standalone 5e/PF2e catalog originals must reach the existing typed private-assignment path. */
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { prepareImport } from '../src/importing/package';
import { prepareCatalogTemplate } from '../src/importing/catalog';
import { dndCatalogKind, isDndCatalogSystem } from '../src/importing/dnd-catalogs';

const fixture = '.reference/official-releases-2026-11-16/5e-system.rpg';
const folder = '.reference/rpg-companion-app-systems/systems/5e/resource_instances/';
const samples = [
  ['spell', 'spell_magic_missile.rpg.json', 'Magic Missile'],
  ['weapon', 'weapon_longsword.rpg.json', 'Longsword'],
  ['armor', 'armor_leather.rpg.json', 'Leather'],
  ['item', 'item_torch.rpg.json', 'Torch']
] as const;

it.skipIf(!existsSync(fixture)).each(samples)('maps the unchanged original %s catalog for private assignment', async (kind, file, name) => {
  const system = await prepareImport(new Uint8Array(readFileSync(fixture)), fixture);
  const original = readFileSync(folder + file, 'utf8');
  const preview = await prepareCatalogTemplate(original, file, system);
  expect(preview.resources[0]).toMatchObject({ definitionId: kind, name, catalogSource: { original } });
  expect(preview.resources[0].catalogIssue).toBeUndefined();
});

const pf2eFixture = '.reference/official-releases-2026-11-16/pf2e-system.rpg';
const pf2eFolder = '.reference/rpg-companion-app-systems/systems/pf2e/resource_instances/';
const pf2eSamples = [
  ['monster', 'monster_goblin_warrior__b1_.rpg.json', 'Goblin Warrior'],
  ['spell', 'spell_fireball__pc1_.rpg.json', 'Fireball'],
  ['weapon', 'weapon_longsword__pc1_.rpg.json', 'Longsword'],
  ['armor', 'armor_breastplate__pc1_.rpg.json', 'Breastplate'],
  ['item', 'item_adventurer_s_pack__pc1_.rpg.json', 'Adventurer\'s Pack']
] as const;

it.skipIf(!existsSync(pf2eFixture)).each(pf2eSamples)('maps the unchanged original PF2e %s catalog against the uploaded official system', async (kind, file, name) => {
  const system = await prepareImport(new Uint8Array(readFileSync(pf2eFixture)), pf2eFixture);
  const original = readFileSync(pf2eFolder + file, 'utf8');
  const preview = await prepareCatalogTemplate(original, file, system);
  expect(preview.resources[0]).toMatchObject({ definitionId: kind, name, catalogSource: { original } });
  expect(preview.resources[0].catalogIssue).toBeUndefined();
});

it('classifies catalog paths only inside the selected system directory', () => {
  expect(dndCatalogKind('systems/pf2e/resource_instances/spell_fireball__pc1_.rpg.json', 'pf2e')).toBe('spell');
  expect(dndCatalogKind('systems/pf2e/resource_instances/spell_fireball__pc1_.rpg.json', '5e')).toBeUndefined();
  expect(dndCatalogKind('systems/5e/resource_instances/monster_goblin_goblin.json', 'pf2e')).toBeUndefined();
  expect(dndCatalogKind('systems/pf2e/resource_instances/feat_power_attack.rpg.json', 'pf2e')).toBeUndefined();
  expect(dndCatalogKind('systems/PF2E/resource_instances/spell_x.json', 'pf2e')).toBeUndefined();
  expect(isDndCatalogSystem('pf2e') && isDndCatalogSystem('5e') && !isDndCatalogSystem('5e2024')).toBe(true);
});
