// @vitest-environment node
/** @file Selective categories and private spell/equipment assignments preserve exact originals. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { prepareImport } from '../src/importing/package';
import { prepareCatalogTemplate } from '../src/importing/catalog';
import { prepareSystem } from '../src/importing/system';
import { DND_CATALOG_KINDS, discoverDndCatalogs, dndCatalogKind, prepareDndCatalog } from '../src/importing/dnd-catalogs';
import { SheetDatabase, createCharacter, installSystem } from '../src/persistence/db';
import { assignCatalog, installCatalogs, stageTemplate } from '../src/persistence/catalog';
import { base, capabilitySystem } from './fixtures/capabilities';

const fixture = '.reference/official-releases-2026-11-16/5e-system.rpg';
const folder = '.reference/rpg-companion-app-systems/systems/5e/resource_instances/';
const samples = [
  ['spell', 'spell_magic_missile.rpg.json', 'spells'],
  ['weapon', 'weapon_longsword.rpg.json', 'weapons'],
  ['armor', 'armor_leather.rpg.json', 'armors'],
  ['item', 'item_torch.rpg.json', 'equipment']
] as const;
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

for (const [kind, file, field] of samples) it.skipIf(!existsSync(fixture) || !existsSync(folder + file))(
  `assigns unchanged ${kind} originals as independent private graphs`, async () => {
  const system = await prepareImport(new Uint8Array(readFileSync(fixture)), fixture);
  const original = readFileSync(folder + file, 'utf8');
  const preview = await prepareCatalogTemplate(original, file, system);
  expect(preview.resources[0].definitionId).toBe(kind);
  expect(preview.resources[0].catalogIssue).toBeUndefined();
  const database = new SheetDatabase('real-catalog-' + crypto.randomUUID());
  try {
    await installSystem(system, database);
    const [id] = await installCatalogs([preview], database);
    const before = await database.resources.toArray();
    await stageTemplate(id, database);
    expect(await database.resources.toArray()).toEqual(before);
    const first = await createCharacter(system, 'First', database), second = await createCharacter(system, 'Second', database);
    await assignCatalog(first.id, id, field, database);
    await assignCatalog(second.id, id, field, database);
    await assignCatalog(first.id, id, field, database);
    const a = (await database.characters.get(first.id))!, b = (await database.characters.get(second.id))!;
    expect(a.values[field]).toHaveLength(2); expect(b.values[field]).toHaveLength(1);
    const assigned = [a.values[field], b.values[field]].flat();
    expect(new Set(assigned.map(value => JSON.stringify(value))).size).toBe(3);
    expect(await database.resources.get(id)).toEqual(before[0]);
    const saved = await database.resources.toArray();
    await expect(assignCatalog(first.id, id, 'missing', database)).rejects.toThrow();
    expect(await database.resources.toArray()).toEqual(saved);
    expect(await database.characters.get(first.id)).toEqual(a);
  } finally { await database.delete(); }
});

it('classifies only supported 5e categories, excluding other editions and directories', () => {
  for (const kind of DND_CATALOG_KINDS) expect(dndCatalogKind(`systems/5e/resource_instances/${kind}_original.rpg.json`, '5e')).toBe(kind);
  for (const path of ['systems/5e2024/resource_instances/spell_original.json',
    'systems/pf2e/resource_instances/item_original.json', 'systems/5e/resource_instances/encounter_original.json',
    'systems/5e/resource_instances/../spell_original.json']) expect(dndCatalogKind(path, '5e')).toBeUndefined();
});

it('discovers metadata for all categories and downloads only matching selected roots', async () => {
  const commit = '3'.repeat(40), tree = '4'.repeat(40);
  const originals = new Map(DND_CATALOG_KINDS.map(kind => [
    `systems/5e/resource_instances/${kind}_original.rpg.json`,
    JSON.stringify({ resource_id: kind, stats: { name: { value: kind } } })
  ]));
  const files = [...originals].map(([path, body]) => ({ path, size: Buffer.byteLength(body), mode: '100644', type: 'blob' }));
  const fetch = vi.fn(async (url: URL) => {
    if (url.hostname === 'api.github.com') return Response.json(url.pathname.endsWith('/commits')
      ? [{ sha: commit, commit: { tree: { sha: tree } } }] : { sha: tree, truncated: false, tree: files });
    const path = decodeURIComponent(url.pathname.split(`/${commit}/`)[1]);
    expect(originals.has(path)).toBe(true);
    return new Response(originals.get(path));
  });
  vi.stubGlobal('fetch', fetch);
  const snapshot = await discoverDndCatalogs('5e');
  expect(snapshot.files).toHaveLength(5); expect(fetch).toHaveBeenCalledTimes(2);
  const system = await prepareSystem(JSON.stringify({ ...capabilitySystem, id: '5e',
    resources: [...capabilitySystem.resources, ...DND_CATALOG_KINDS.map(id => ({
      id, name: id, stats: [base('name', 'string', '')]
    }))] }), 'Original MIT catalog fixture');
  for (const file of files) {
    const preview = await prepareDndCatalog(snapshot, file.path, system);
    expect(preview.resources[0].catalogSource?.original).toBe(originals.get(file.path));
    expect(preview.resources[0].catalogIssue).toBeUndefined();
  }
  expect(fetch).toHaveBeenCalledTimes(7);
  fetch.mockClear();
  await expect(prepareDndCatalog(snapshot, files[1].path, {
    ...system, definition: { ...system.definition, id: '5e2024' }
  })).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  const wrong = originals.get(files[2].path)!;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(wrong)));
  await expect(prepareDndCatalog({ ...snapshot, files: [{ ...files[1], size: Buffer.byteLength(wrong) }] },
    files[1].path, system)).rejects.toThrow();
});

it.skipIf(!existsSync(fixture) || !existsSync(folder))('audits all pinned spell and equipment originals under unchanged validation', async () => {
  const system = await prepareImport(new Uint8Array(readFileSync(fixture)), fixture);
  const counts: Record<string, number> = {}, issues: string[] = [];
  const blocked = [
    'armor_shield.rpg.json', 'item_arrow.rpg.json', 'item_bag_of_beans.rpg.json',
    'item_bag_of_tricks,_gray.rpg.json', 'item_bag_of_tricks,_rust.rpg.json', 'item_bag_of_tricks,_tan.rpg.json',
    'item_ball_bearing.rpg.json', 'item_bead_of_force.rpg.json', 'item_blowgun_needle.rpg.json',
    "item_burglar's_pack.rpg.json", 'item_caltrop.rpg.json', 'item_chromatic_rose.rpg.json',
    'item_crossbow_bolt.rpg.json', 'item_dragonchess_set.rpg.json', "item_dungeoneer's_pack.rpg.json",
    'item_iron_spike.rpg.json', 'item_modern_bullet.rpg.json', 'item_piton.rpg.json',
    'item_potion_of_healing.rpg.json', 'item_renaissance_bullet.rpg.json', 'item_sack.rpg.json',
    'item_steel_mirror.rpg.json', 'spell_green-flame_blade.rpg.json', "spell_raulothim's_psychic_lance.rpg.json"
  ];
  for (const file of readdirSync(folder)) {
    const kind = dndCatalogKind('systems/5e/resource_instances/' + file, '5e');
    if (!kind || kind === 'monster') continue;
    counts[kind] = (counts[kind] ?? 0) + 1;
    const original = readFileSync(folder + file, 'utf8'), source = JSON.parse(original);
    const preview = await prepareCatalogTemplate(original, file, system);
    if (preview.resources[0].catalogIssue) issues.push(file);
    if (blocked.includes(file)) {
      // Independent source evidence: foreign pin, undeclared root metadata, or fractional integer fields.
      if (file === 'armor_shield.rpg.json') expect(source.stats.cost.value.system).toBe('5e2024');
      else if (kind === 'spell') expect(Object.hasOwn(source, 'updated_at')).toBe(true);
      else expect(['cost', 'weight'].some(field => {
        const value = source.stats[field]?.value?.stats?.value?.value;
        return typeof value === 'number' && !Number.isInteger(value);
      })).toBe(true);
    }
  }
  expect(counts).toEqual({ spell: 538, weapon: 194, armor: 62, item: 734 });
  expect(system.definition.resources.find(r => r.id === 'weight')!.stats.find(s => s.id === 'value')!.value_type).toBe('integer');
  expect(system.definition.resources.find(r => r.id === 'cost')!.stats.find(s => s.id === 'value')!.value_type).toBe('integer');
  expect(issues).toEqual(blocked);
}, 30000);
