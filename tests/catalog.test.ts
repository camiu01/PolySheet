// @vitest-environment node
/** @file Compact originals, immutable templates, private copies and atomic repository installation. */
import { MAX_STORED_RESOURCES } from '../src/domain/model';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { SheetDatabase, createCharacter, installSystem, setCharacterValue } from '../src/persistence/db';
import { assignCatalog, installCatalogs, installRepositoryBundle, removeCharacterClass, setCharacterSubrace } from '../src/persistence/catalog';
import { prepareSystem } from '../src/importing/system';
import { prepareImport } from '../src/importing/package';
import { prepareCatalog, prepareCatalogTemplate } from '../src/importing/catalog';
import { exportBackup, restoreBackup, validateBackup } from '../src/persistence/backup';
import { saveResource, deleteResource } from '../src/persistence/resources';
import { commitResourceView } from '../src/persistence/views';
import { isResourceReference } from '../src/domain/model';
import { createEvaluator } from '../src/engine/formulas';
import { backgroundOriginal, catalogSystem, classOriginal, raceOriginal } from './fixtures/catalog';
import { capabilitySystem } from './fixtures/capabilities';
import { createCombat, commandCombat } from '../src/persistence/combat';
import { combatContext } from '../src/engine/combat';

const databases: SheetDatabase[] = [];
afterEach(async () => { for (const d of databases.splice(0)) await d.delete(); });
async function setup(source: unknown = catalogSystem) {
  const database = new SheetDatabase('catalog-' + crypto.randomUUID()); databases.push(database);
  const system = await prepareSystem(JSON.stringify(source), 'Original MIT catalog test');
  await installSystem(system, database);
  return { database, system };
}
it('stores one exact original per template instead of all nested instances; repeats are idempotent', async () => {
  const { database, system } = await setup();
  const preview = await prepareCatalogTemplate(classOriginal, 'local-class.rpg.json', system);
  expect(preview.resources).toHaveLength(1);
  expect(preview.resources[0].values).toEqual({});
  expect(preview.resources[0].catalogIssue).toBeUndefined();
  const [id] = await installCatalogs([preview], database);
  expect(await installCatalogs([preview, preview], database)).toEqual([id, id]);
  expect(await database.resources.count()).toBe(1);
  expect((await database.resources.get(id))?.catalogSource?.original).toBe(classOriginal);
  const backup = await exportBackup(database); await restoreBackup(backup, database);
  expect((await database.resources.get(id))?.catalogSource?.original).toBe(classOriginal);
});
it('copies nested class graphs per character and preserves upstream identities without applying effects', async () => {
  const { database, system } = await setup();
  const [templateId] = await installCatalogs([await prepareCatalogTemplate(classOriginal, 'class.json', system)], database);
  const a = await createCharacter(system, 'A', database), b = await createCharacter(system, 'B', database);
  await Promise.all([assignCatalog(a.id, templateId, 'classes', database), assignCatalog(b.id, templateId, 'classes', database)]);
  const resources = await database.resources.toArray();
  expect(resources).toHaveLength(7);
  const characters = await database.characters.toArray();
  const roots = characters.map(c => {
    const ref = (c.values.classes as { resourceId: string }[])[0];
    const wrapper = resources.find(r => r.id === ref.resourceId)!;
    expect(wrapper.values.class_level).toBe(1);
    expect(isResourceReference(wrapper.values.class)).toBe(true);
    return resources.find(r => r.id === (wrapper.values.class as { resourceId: string }).resourceId)!;
  });
  expect(roots[0].id).not.toBe(roots[1].id);
  expect(roots.map(r => r.sourceId)).toEqual(['original-class', 'original-class']);
  const e = createEvaluator(system.definition.character_stats, characters[0].values, undefined,
    { resources, resourceDefinitions: system.definition.resources });
  expect(e.get('vigore')).toBe(2);
  const root = roots[0], featureId = (root.values.features as { resourceId: string }[])[0].resourceId;
  await commitResourceView(featureId, { amount: 9 }, [], database);
  const otherFeature = (roots[1].values.features as { resourceId: string }[])[0].resourceId;
  expect((await database.resources.get(otherFeature))?.values.amount).toBe(2);
  expect((await database.resources.get(templateId))?.catalogSource?.original).toBe(classOriginal);
  await expect(deleteResource(root.id, database)).rejects.toThrow();
  const backup = await exportBackup(database); await restoreBackup(backup, database);
  expect(await database.resources.count()).toBe(7);
});
it('repeated and overlapping assignments preserve other fields and unlink only the selected class', async () => {
  const { database, system } = await setup();
  const [id] = await installCatalogs([await prepareCatalogTemplate(classOriginal, 'class.json', system)], database);
  const c = await createCharacter(system, 'Concurrent', database);
  await Promise.all([assignCatalog(c.id, id, 'classes', database), assignCatalog(c.id, id, 'classes', database), setCharacterValue(c.id, 'vigore', 7, database)]);
  const current = await database.characters.get(c.id);
  expect(current?.values.vigore).toBe(7); expect(current?.values.classes).toHaveLength(2);
  const refs = current!.values.classes as { resourceId: string }[];
  await removeCharacterClass(c.id, refs[0].resourceId, database);
  expect((await database.characters.get(c.id))?.values.classes).toEqual([refs[1]]);
});
it('retains incompatible originals visibly but refuses assignment, cross-version refs and template edits', async () => {
  const { database, system } = await setup();
  const input = JSON.parse(classOriginal.slice(1)); input.stats.features.value[0].stats.amount.value = 'bad';
  const original = JSON.stringify(input);
  const bad = await prepareCatalogTemplate(original, 'invalid.json', system);
  expect(bad.resources[0].catalogIssue).toContain('Valore non valido');
  const [id] = await installCatalogs([bad], database);
  const c = await createCharacter(system, 'Blocked', database);
  await expect(assignCatalog(c.id, id, 'classes', database)).rejects.toThrow();
  const record = (await database.resources.get(id))!;
  await expect(saveResource({ ...record, name: 'Changed' }, database)).rejects.toThrow('immutabile');
  await expect(commitResourceView(id, { name: 'Changed' }, [], database)).rejects.toThrow('immutabile');
  const [race] = await installCatalogs([await prepareCatalogTemplate(raceOriginal, 'race.json', system)], database);
  await expect(setCharacterValue(c.id, 'race', { resourceId: race }, database)).rejects.toThrow();
  await assignCatalog(c.id, race, 'race', database);
  expect((await database.characters.get(c.id))?.values.race).not.toEqual({ resourceId: race });
  const other = await prepareSystem(JSON.stringify({ ...catalogSystem, version: '2' }), 'Other version');
  await installSystem(other, database); const foreign = await createCharacter(other, 'Foreign', database);
  await expect(assignCatalog(foreign.id, race, 'race', database)).rejects.toThrow();
  const backup = JSON.parse(await exportBackup(database));
  backup.resources.find((r: { id: string }) => r.id === id).catalogIssue = undefined;
  const validated = await validateBackup(JSON.stringify(backup));
  expect(validated.resources.find(r => r.id === id)?.catalogIssue).toBeTruthy();
});
it('rejects changed catalog values, names, originals and digest before replacing any user data', async () => {
  const { database, system } = await setup();
  await installCatalogs([await prepareCatalogTemplate(classOriginal, 'class.json', system)], database);
  const backup = await exportBackup(database);
  for (const mutate of [
    (r: Record<string, unknown>) => { r.values = { name: 'Altered' }; },
    (r: Record<string, unknown>) => { r.name = 'Altered'; },
    (r: Record<string, unknown>) => { (r.catalogSource as Record<string, unknown>).original = '{}'; },
    (r: Record<string, unknown>) => { r.catalogGroup = 'missing'; }
  ]) {
    const data = JSON.parse(backup); mutate(data.resources[0]);
    await expect(restoreBackup(JSON.stringify(data), database)).rejects.toThrow();
    expect(await exportBackup(database)).toContain('original-class');
  }
});
it('revalidates all originals before installing a repository bundle atomically', async () => {
  const { database, system } = await setup();
  const next = await prepareSystem(JSON.stringify({ ...catalogSystem, version: '2' }), 'Next import');
  const good = await prepareCatalogTemplate(classOriginal, 'class.json', next);
  const bad = { ...good, resources: [{ ...good.resources[0], catalogSource: { ...good.resources[0].catalogSource!, original: '{}' } }] };
  await expect(installRepositoryBundle(next, [good, bad], database)).rejects.toThrow();
  expect(await database.systems.count()).toBe(1); expect(await database.resources.count()).toBe(0);
  await installRepositoryBundle(next, [good], database);
  expect(await database.systems.count()).toBe(2); expect(await database.resources.count()).toBe(1);
  expect((await database.systems.get(system.key))?.original).toBe(system.original);
});
it('rejects malformed envelopes, undeclared fields and source rewriting instead of coercing them', async () => {
  const { system } = await setup();
  for (const input of [
    { resource_id: 'unknown', stats: {} },
    { resource_id: 'class', stats: { name: { value: 'A' }, surprise: { value: 1 } } },
    { system: 'foreign', resource_id: 'class', stats: { name: { value: 'A' } } }
  ]) await expect(prepareCatalog(JSON.stringify(input), 'bad.json', system)).rejects.toThrow();
});
const originals = resolve('.reference/rpg-companion-app-systems/systems');
const releases = resolve('.reference/official-releases-2026-11-16');
for (const [id, expected, blocked] of [['5e', 208, 0], ['5e2024', 74, 19], ['pf2e', 141, 0]] as const) {
  it(`preserves every pinned ${id} class/ancestry original, checks compact backup and private assignment`, async ctx => {
    const dir = resolve(originals, id, 'resource_instances'), file = resolve(releases, `${id}-system.rpg`);
    if (!existsSync(dir) || !existsSync(file)) { ctx.skip('Licensed local-only repository and official release are absent'); return; }
    const database = new SheetDatabase('real-catalog-' + crypto.randomUUID()); databases.push(database);
    const system = await prepareImport(new Uint8Array(readFileSync(file)), 'Pinned official original');
    const previews = [];
    for (const name of readdirSync(dir).filter(n => /^(class|race|species|ancestry|heritage|background)_.*\.rpg\.json$/.test(n))) {
      const original = readFileSync(resolve(dir, name), 'utf8');
      previews.push(await prepareCatalogTemplate(original, name, system));
    }
    expect(previews).toHaveLength(expected);
    if (id === '5e2024') {
      const invalid = previews.filter(p => p.resources[0].definitionId === 'background' && p.resources[0].catalogIssue);
      expect(invalid.map(p => p.resources[0].name)).toEqual(['Guard', 'Guide', 'Soldier']);
      expect(invalid.every(p => p.resources[0].catalogIssue?.includes('stats.weight.value.stats.value'))).toBe(true);
    }
    expect(previews.filter(p => p.resources[0].catalogIssue)).toHaveLength(blocked);
    await installRepositoryBundle(system, previews, database);
    expect(await database.resources.count()).toBe(expected);
    if (id === '5e2024')
      expect(previews.find(p => p.resources[0].name === 'Fighter')?.resources[0].catalogIssue).toContain('stats.weight.value.stats.value');
    const selectedClass = previews.find(p => p.resources[0].name === (id === 'pf2e' ? 'Fighter' : 'Druid'))!;
    expect(selectedClass.resources[0].catalogIssue).toBeUndefined();
    const template = (await database.resources.toArray()).find(r => r.catalogSource?.digest === selectedClass.resources[0].catalogSource?.digest)!;
    const character = await createCharacter(system, 'Real source path', database);
    const field = system.definition.character_stats.find(s => s.type === 'base' && s.value_type === 'array' && s.sub_value_type === 'resource'
      && system.definition.resources.some(d => d.id === s.resource_type && d.stats.some(f => f.id === 'class')))!;
    await assignCatalog(character.id, template.id, field.id, database);
    if (id !== 'pf2e') {
      const records = await database.resources.toArray();
      const land = records.find(r => !r.catalogSource && r.sourceId === 'druid_circle_of_the_land')!;
      expect(land).toBeDefined();
      const features = (land.values.features as { resourceId: string }[]).map(ref => records.find(r => r.id === ref.resourceId)?.sourceId);
      expect(features).toHaveLength(id === '5e' ? 6 : 5);
      expect(features).not.toContain(id === '5e' ? 'circle_spells' : 'natural_recovery');
    }
    const background = previews.find(p => p.resources[0].definitionId === 'background' && !p.resources[0].catalogIssue)!;
    expect(background).toBeDefined();
    const backgroundTemplate = (await database.resources.toArray()).find(r => r.catalogSource?.digest === background.resources[0].catalogSource?.digest)!;
    await assignCatalog(character.id, backgroundTemplate.id, 'background', database);
    if (id === '5e') {
      const raceTemplate = previews.find(p => p.resources[0].definitionId === 'race' && !p.resources[0].catalogIssue
        && JSON.parse(p.resources[0].catalogSource!.original).stats.subraces?.value?.length > 0)!.resources[0];
      const expectedId = JSON.parse(raceTemplate.catalogSource!.original).stats.subraces.value[0].stats.id;
      expect(typeof expectedId).toBe('string');
      const storedRace = (await database.resources.toArray()).find(r => r.catalogSource?.digest === raceTemplate.catalogSource!.digest)!;
      await assignCatalog(character.id, storedRace.id, 'race', database);
      const current = (await database.characters.get(character.id))!;
      await setCharacterSubrace(character.id, (current.values.race as { resourceId: string }).resourceId, expectedId, database);
      expect((await database.characters.get(character.id))?.values.subrace_id).toBe(expectedId);
    }
    const backup = await exportBackup(database);
    expect(Buffer.byteLength(backup)).toBeLessThan(32 * 1024 * 1024);
    await restoreBackup(backup, database);
    const restored = await database.resources.get(template.id);
    expect(restored?.catalogSource?.original).toBe(selectedClass.resources[0].catalogSource?.original);
    expect((await database.characters.get(character.id))?.values[field.id]).toHaveLength(1);
  }, 90000);
}

it('rolls back an over-capacity import, accepts exactly the archive limit and refuses overflowing assignment', async () => {
  const { database, system } = await setup();
  await database.resources.bulkAdd(Array.from({ length: MAX_STORED_RESOURCES - 1 }, (_, i) => ({
    id: `local-${i}`, systemKey: system.key, definitionId: 'race', name: `Local ${i}`, values: { name: `Local ${i}` }
  })));
  const a = await prepareCatalogTemplate(classOriginal, 'class.json', system);
  const b = await prepareCatalogTemplate(raceOriginal, 'race.json', system);
  await expect(installRepositoryBundle(system, [a, b], database)).rejects.toThrow('100.000');
  expect(await database.resources.count()).toBe(MAX_STORED_RESOURCES - 1);
  const [id] = await installCatalogs([a], database);
  expect(await database.resources.count()).toBe(MAX_STORED_RESOURCES);
  const character = await createCharacter(system, 'At limit', database);
  await expect(assignCatalog(character.id, id, 'classes', database)).rejects.toThrow('100.000');
  expect(await database.resources.count()).toBe(MAX_STORED_RESOURCES);
  expect((await database.characters.get(character.id))?.values.classes).toEqual([]);
}, 180000);

it('deletes an unused private graph together without dangling catalog groups', async () => {
  const { database, system } = await setup();
  const [id] = await installCatalogs([await prepareCatalogTemplate(classOriginal, 'class.json', system)], database);
  const character = await createCharacter(system, 'Delete copy', database);
  await assignCatalog(character.id, id, 'classes', database);
  const current = (await database.characters.get(character.id))!;
  const wrapperId = (current.values.classes as { resourceId: string }[])[0].resourceId;
  const wrapper = (await database.resources.get(wrapperId))!;
  const rootId = (wrapper.values.class as { resourceId: string }).resourceId;
  await removeCharacterClass(character.id, wrapperId, database);
  await deleteResource(wrapperId, database);
  await deleteResource(rootId, database);
  expect(await database.resources.count()).toBe(1);
  await validateBackup(await exportBackup(database));
  expect((await database.resources.get(id))?.catalogSource?.original).toBe(classOriginal);
});

it('cannot use an immutable compact template as a mutable combat source or forge it through backup', async () => {
  const { database, system } = await setup({ ...catalogSystem, combat_system: {
    ...capabilitySystem.combat_system,
    combatant_types: [{ id: 'class', name: 'Class source', template_resource_id: 'class', instance_resource_id: null, side: 'party' }]
  } });
  const [id] = await installCatalogs([await prepareCatalogTemplate(classOriginal, 'class.json', system)], database);
  const encounter = await createCombat(system.key, 'Template guard', database);
  await expect(commandCombat(encounter.id, { type: 'add', typeId: 'class', sourceId: id }, database)).rejects.toThrow('non compatibile');
  expect((await database.combats.get(encounter.id))?.combatants).toHaveLength(0);
  const forged = { ...encounter, combatants: [{
    id: 'forged', typeId: 'class', resourceId: id, values: {}, overrides: {},
    initiative: null, tieBreakers: [], createdAt: new Date().toISOString()
  }] };
  const resources = await database.resources.toArray();
  expect(() => combatContext(system, forged, [], resources)).toThrow();
  const backup = JSON.parse(await exportBackup(database)); backup.combats = [forged];
  await expect(validateBackup(JSON.stringify(backup))).rejects.toThrow('Risorsa combattente mancante');
});

it('stages a private catalog graph for a draft without writing or mutating the template', async () => {
  const { stageTemplate } = await import('../src/persistence/catalog');
  const { database, system } = await setup();
  const [templateId] = await installCatalogs([await prepareCatalogTemplate(raceOriginal, 'race.json', system)], database);
  const before = await database.resources.toArray();
  const first = await stageTemplate(templateId, database), second = await stageTemplate(templateId, database);
  expect(await database.resources.toArray()).toEqual(before);
  expect(first.additions[0].id).toBe(first.rootId);
  expect(first.additions.every(r => !r.catalogSource && r.catalogGroup === first.rootId)).toBe(true);
  expect(first.rootId).not.toBe(second.rootId);
  expect(first.additions.map(r => r.definitionId)).toEqual(second.additions.map(r => r.definitionId));
});

it('persists a draft-staged private catalog graph atomically with the new character', async () => {
  const { stageTemplate, configureCharacter } = await import('../src/persistence/catalog');
  const { database, system } = await setup();
  const [templateId] = await installCatalogs([await prepareCatalogTemplate(backgroundOriginal, 'background.json', system)], database);
  const { rootId, additions } = await stageTemplate(templateId, database);
  expect(additions.length).toBeGreaterThan(1);
  const character = await configureCharacter(system, 'Copia', { background: { resourceId: rootId } }, {}, undefined, database, false, additions);
  expect(character.values.background).toEqual({ resourceId: rootId });
  const saved = await database.resources.bulkGet(additions.map(r => r.id));
  expect(saved.every(r => r && !r.catalogSource && r.catalogGroup === rootId)).toBe(true);
  expect((await database.resources.get(templateId))?.catalogSource?.original).toBe(backgroundOriginal);
});

it('still rejects a new record that forges catalog identity', async () => {
  const { saveResource } = await import('../src/persistence/resources');
  const { database, system } = await setup();
  const [templateId] = await installCatalogs([await prepareCatalogTemplate(raceOriginal, 'race.json', system)], database);
  await expect(saveResource({ id: crypto.randomUUID(), systemKey: system.key, definitionId: 'race', name: 'Falsa', values: {}, catalogGroup: templateId }, database))
    .rejects.toThrow();
});

it('batch-adds staged records but rejects forged catalog identity, duplicates and dangling links', async () => {
  const { addResources } = await import('../src/persistence/resources');
  const { database, system } = await setup();
  const [templateId] = await installCatalogs([await prepareCatalogTemplate(raceOriginal, 'race.json', system)], database);
  const base = { systemKey: system.key, definitionId: 'race', name: 'Copia', values: {} };
  await expect(addResources([{ ...base, id: crypto.randomUUID(), catalogGroup: templateId }], system.key, database)).rejects.toThrow();
  await expect(addResources([{ ...base, id: templateId }], system.key, database)).rejects.toThrow();
  await expect(addResources([{ ...base, id: crypto.randomUUID(), values: { subraces: [{ resourceId: 'missing' }] } }], system.key, database)).rejects.toThrow();
  const root = crypto.randomUUID(), child = crypto.randomUUID();
  await addResources([{ ...base, id: root, catalogGroup: root, values: { subraces: [{ resourceId: child }] } },
    { ...base, id: child, catalogGroup: root, sourceId: 'up-child' }], system.key, database);
  expect(await database.resources.count()).toBe(3);
});
