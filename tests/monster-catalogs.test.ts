// @vitest-environment node
/** @file Monster originals remain immutable while sheet/encounter assignments receive private graphs. */
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { prepareImport } from '../src/importing/package';
import { prepareSystem } from '../src/importing/system';
import { prepareCatalogTemplate } from '../src/importing/catalog';
import { SheetDatabase, createCharacter, installSystem } from '../src/persistence/db';
import { installCatalogs, stageTemplate } from '../src/persistence/catalog';
import { createCombat, commandCombat } from '../src/persistence/combat';
import { commitCharacterView } from '../src/persistence/views';
import { combatContext } from '../src/engine/combat';
import { exportBackup, restoreBackup } from '../src/persistence/backup';
import { base, capabilitySystem, stat } from './fixtures/capabilities';
import { discoverDndCatalogs, prepareDndCatalog } from '../src/importing/dnd-catalogs';
import { photoImageUrl } from '../src/domain/photo';
import { MAX_SYSTEM_BYTES } from '../src/importing/system';

const original = JSON.stringify({ resource_id: 'monster', stats: {
  id: 'original-creature', name: { value: 'Creatura di prova' }, vitals: { value: {
    resource_id: 'vitals', stats: { id: 'original-vitals', hp: { value: 7 } }
  } }
} });
const definition = { ...capabilitySystem, id: '5e',
  resources: [...capabilitySystem.resources,
    { id: 'vitals', name: 'Valori', stats: [base('hp', 'integer', 0)] },
    { id: 'monster', name: 'Monster', stats: [base('name', 'string', ''),
      { ...base('vitals', 'resource', null), resource_type: 'vitals' }] }],
  combat_system: { ...capabilitySystem.combat_system, combatant_types: [{
    id: 'monster', name: 'Monster', template_resource_id: 'monster', instance_resource_id: 'scout', side: 'enemy',
    on_create: { type: 'setStat', stat: 'hp', aggregation_type: 'set', new_value: stat('$resource.vitals.hp') }
  }] }
};
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('discovers all bestiary metadata without downloading contents, then fetches only one pinned file', async () => {
  const commit = '1'.repeat(40), tree = '2'.repeat(40);
  const files = Array.from({ length: 1416 }, (_, i) => ({
    path: `systems/5e/resource_instances/monster_${i}.json`, size: Buffer.byteLength(original), mode: '100644', type: 'blob'
  }));
  const fetch = vi.fn(async (url: URL) => {
    if (url.hostname === 'api.github.com') return Response.json(url.pathname.endsWith('/commits')
      ? [{ sha: commit, commit: { tree: { sha: tree } } }]
      : { sha: tree, truncated: false, tree: [...files,
        { ...files[0], path: 'systems/5e2024/resource_instances/monster_other.json' },
        { ...files[0], path: 'systems/5e/resource_instances/monster_symlink.json', mode: '120000' }] });
    expect(url.href).toBe(`https://raw.githubusercontent.com/blastervla/rpg-companion-app-systems/${commit}/${files[1415].path}`);
    return new Response(original);
  });
  vi.stubGlobal('fetch', fetch);
  const snapshot = await discoverDndCatalogs('5e');
  expect(snapshot.files).toHaveLength(1416);
  expect(fetch).toHaveBeenCalledTimes(2);
  const system = await prepareSystem(JSON.stringify(definition), 'Original MIT monster fixture');
  const preview = await prepareDndCatalog(snapshot, files[1415].path, system);
  expect(preview.resources[0].catalogSource?.original).toBe(original);
  expect(fetch).toHaveBeenCalledTimes(3);
  fetch.mockClear();
  for (const path of ['systems/5e/resource_instances/../monster_1415.json', 'unknown.json'])
    await expect(prepareDndCatalog(snapshot, path, system)).rejects.toThrow();
  await expect(prepareDndCatalog({ ...snapshot, repository: 'https://github.com/other/repo' }, files[0].path, system)).rejects.toThrow();
  await expect(prepareDndCatalog({ ...snapshot, files: [{ ...files[0], size: MAX_SYSTEM_BYTES + 1 }] }, files[0].path, system)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(original + ' ')));
  await expect(prepareDndCatalog(snapshot, files[0].path, system)).rejects.toThrow('Dimensione');
});

it('maps omitted source photo members to nullable internal slots without fetching URLs or accepting invalid photos', async () => {
  const system = await prepareSystem(JSON.stringify({ ...definition, resources: definition.resources.map(r =>
    r.id === 'monster' ? { ...r, stats: [...r.stats, base('photo', 'photo', null)] } : r) }), 'Photo fixture');
  const input = JSON.parse(original);
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  input.stats.photo = { value: { url: 'https://images.test/monster.png' } };
  const preview = await prepareCatalogTemplate(JSON.stringify(input), 'monster.json', system);
  expect(preview.resources[0].catalogIssue).toBeUndefined();
  const database = new SheetDatabase('monster-photo-' + crypto.randomUUID());
  try {
    await installSystem(system, database);
    const [id] = await installCatalogs([preview], database);
    const staged = await stageTemplate(id, database);
    const photo = staged.additions.find(r => r.id === staged.rootId)!.values.photo;
    expect(photo).toEqual({ url: 'https://images.test/monster.png', base64: null });
    expect(photoImageUrl({ url: 'https://images.test/monster.png', base64: null })).toBeNull();
    for (const value of [{ base64: 'invalid' }, { url: 'https://images.test/x.png', unknown: true }]) {
      input.stats.photo.value = value;
      expect((await prepareCatalogTemplate(JSON.stringify(input), 'monster.json', system)).resources[0].catalogIssue).toBeTruthy();
    }
    expect(fetch).not.toHaveBeenCalled();
  } finally { await database.delete(); }
});

it('stages monsters for a sheet and adds separate private encounter graphs without changing originals', async () => {
  const system = await prepareSystem(JSON.stringify(definition), 'Original MIT monster fixture');
  const database = new SheetDatabase('monster-' + crypto.randomUUID());
  try {
    await installSystem(system, database);
    const preview = await prepareCatalogTemplate(original, 'monster_original.json', system);
    expect(preview.resources[0].catalogIssue).toBeUndefined();
    const [id] = await installCatalogs([preview], database);
    const before = await database.resources.toArray();
    const staged = await stageTemplate(id, database);
    expect(await database.resources.toArray()).toEqual(before);
    const character = await createCharacter(system, 'Sheet', database);
    await commitCharacterView(character.id, { companions: [{ resourceId: staged.rootId }] }, staged.additions, database);
    const encounter = await createCombat(system.key, 'Two monsters', database);
    await commandCombat(encounter.id, { type: 'add', typeId: 'monster', sourceId: id }, database);
    await commandCombat(encounter.id, { type: 'add', typeId: 'monster', sourceId: id }, database);
    const saved = (await database.combats.get(encounter.id))!;
    const ids = saved.combatants.map(f => f.templateId);
    expect(new Set([id, staged.rootId, ...ids]).size).toBe(4);
    const resources = await database.resources.toArray();
    expect(resources).toHaveLength(7);
    const context = combatContext(system, saved, [], resources);
    for (const fighter of saved.combatants) expect(context.actor(fighter.id).get('hp')).toBe(7);
    await commandCombat(encounter.id, { type: 'value', id: saved.combatants[0].id, statId: 'hp', value: 2 }, database);
    expect((await database.resources.get(id))?.catalogSource?.original).toBe(original);
    const backup = await exportBackup(database);
    await restoreBackup(backup, database);
    const restored = (await database.combats.get(encounter.id))!;
    const reopened = combatContext(system, restored, [], await database.resources.toArray());
    expect(restored.combatants.map(f => reopened.actor(f.id).get('hp'))).toEqual([2, 7]);
  } finally { await database.delete(); }
});

it('rolls back newly cloned monster resources when initialization fails', async () => {
  const system = await prepareSystem(JSON.stringify({ ...definition, combat_system: { ...definition.combat_system,
    combatant_types: [{ ...definition.combat_system.combatant_types[0],
      on_create: { type: 'setStat', stat: 'missing', aggregation_type: 'set', new_value: stat('$resource.vitals.hp') } }]
  } }), 'Failing initializer');
  const database = new SheetDatabase('monster-rollback-' + crypto.randomUUID());
  try {
    await installSystem(system, database);
    const [id] = await installCatalogs([await prepareCatalogTemplate(original, 'monster.json', system)], database);
    const encounter = await createCombat(system.key, 'Rollback', database);
    const before = await database.resources.toArray();
    await expect(commandCombat(encounter.id, { type: 'add', typeId: 'monster', sourceId: id }, database)).rejects.toThrow();
    expect(await database.resources.toArray()).toEqual(before);
    expect(await database.combats.get(encounter.id)).toEqual(encounter);
  } finally { await database.delete(); }
});

const fixture = '.reference/official-releases-2026-11-16/5e-system.rpg';
const goblin = '.reference/rpg-companion-app-systems/systems/5e/resource_instances/monster_goblin_goblin.json';
it.skipIf(!existsSync(fixture) || !existsSync(goblin))('imports the unchanged real Goblin and initializes it through the existing 5e combat command', async () => {
  const system = await prepareImport(new Uint8Array(readFileSync(fixture)), fixture);
  const original = readFileSync(goblin, 'utf8');
  const database = new SheetDatabase('real-monster-' + crypto.randomUUID());
  try {
    await installSystem(system, database);
    const preview = await prepareCatalogTemplate(original, goblin, system);
    expect(preview.resources[0]).toMatchObject({ definitionId: 'monster', name: 'Goblin' });
    expect(preview.resources[0].catalogIssue).toBeUndefined();
    const [id] = await installCatalogs([preview], database);
    const encounter = await createCombat(system.key, 'Goblin', database);
    const type = system.definition.combat_system!.combatant_types.find(t => t.template_resource_id === 'monster')!;
    await commandCombat(encounter.id, { type: 'add', typeId: type.id, sourceId: id }, database, () => 3);
    const saved = (await database.combats.get(encounter.id))!;
    const evaluator = combatContext(system, saved, [], await database.resources.toArray()).actor(saved.combatants[0].id);
    expect(evaluator.get('name')).toBe('Goblin #1');
    expect(evaluator.get('current_hp')).toBe(6);
    expect(evaluator.get('armor_class')).toBe(15);
    expect((await database.resources.get(id))!.catalogSource!.original).toBe(original);
  } finally { await database.delete(); }
}, 30000);
