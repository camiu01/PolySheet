/** @file Original Goblin through selective import, companion drafts, encounter copies and offline reopening. */
import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Character, Combat, ResourceInstance } from '../../src/domain/model';
import { it } from '../../src/ui/it';
import { chooseManualGame, openCatalogImport } from './helpers';

async function navigate(page: Page, name: string | RegExp) {
  const menu = page.getByRole('button', { name: 'Navigazione principale', exact: true });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  await page.locator('.sidebar').getByRole('button', { name, exact: true }).click();
}
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('sheetcore');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['resources', 'characters', 'combats']);
    async function all<T>(store: string): Promise<T[]> {
      return new Promise((resolve, reject) => {
        const request = transaction.objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
    }
    const [resources, characters, combats] = await Promise.all([
      all<ResourceInstance>('resources'), all<Character>('characters'), all<Combat>('combats')
    ]);
    const result = { resources, characters, combats };
    database.close(); return result;
  });
}

test('real 5e monsters import selectively and stay isolated across sheet and combat saves', async ({ page, context }, info) => {
  const file = resolve('.reference/official-releases-2026-11-16/5e-system.rpg');
  const folder = '.reference/rpg-companion-app-systems/systems/5e/resource_instances/';
  const goblin = resolve(folder + 'monster_goblin_goblin.json');
  const catalogs = ['class_fighter_fighter', 'race_human', 'background_soldier'].map(name => resolve(folder + name + '.rpg.json'));
  test.skip(!existsSync(file) || !existsSync(goblin) || catalogs.some(f => !existsSync(f)), 'Local-only official 5e/Goblin fixtures are absent');
  const commit = '1'.repeat(40), tree = '2'.repeat(40), original = readFileSync(goblin, 'utf8');
  const path = 'systems/5e/resource_instances/monster_goblin_goblin.json';
  const downloads: string[] = [], images: string[] = [];
  let failNextDownload = true;
  page.on('request', request => { if (request.url().includes('cloudfront.net')) images.push(request.url()); });
  await page.route('https://api.github.com/repos/blastervla/rpg-companion-app-systems/**', route => route.fulfill({
    json: route.request().url().includes('/commits') ? [{ sha: commit, commit: { tree: { sha: tree } } }]
      : { sha: tree, truncated: false, tree: [path, ...Array.from({ length: 51 }, (_, i) =>
        `systems/5e/resource_instances/monster_placeholder_${i}.json`)].map(path => ({
        path, size: Buffer.byteLength(original), mode: '100644', type: 'blob'
      })) }
  }));
  await page.route('https://raw.githubusercontent.com/blastervla/rpg-companion-app-systems/**', async route => {
    expect(route.request().url()).toBe(`https://raw.githubusercontent.com/blastervla/rpg-companion-app-systems/${commit}/${path}`);
    downloads.push(route.request().url());
    if (failNextDownload) {
      failNextDownload = false;
      await route.fulfill({ status: 503, body: 'Service unavailable' }); return;
    }
    await route.fulfill({ body: original, contentType: 'application/json' });
  });
  await page.goto('./'); await navigate(page, it.systems);
  await page.getByLabel(it.localFile).setInputFiles(file);
  await page.getByRole('button', { name: it.confirmImport, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, it.resources); await openCatalogImport(page);
  for (const save of [false, true]) {
    const before = await snapshot(page);
    await page.getByRole('button', { name: it.dndCatalogImport, exact: true }).click();
    const picker = page.getByRole('dialog', { name: it.dndCatalogImport, exact: true });
    await expect(picker.getByRole('button', { name: /^monster_/ })).toHaveCount(50);
    const layout = await picker.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const footer = element.querySelector('.modal-actions')!.getBoundingClientRect();
      const fields = element.querySelector('.source-form-fields')!;
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2,
        footerBottom: footer.bottom, width: innerWidth, height: innerHeight,
        horizontalOverflow: fields.scrollWidth > fields.clientWidth };
    });
    expect(layout.left).toBeGreaterThanOrEqual(15);
    expect(layout.right).toBeLessThanOrEqual(layout.width - 15);
    expect(Math.abs(layout.centerX - layout.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.centerY - layout.height / 2)).toBeLessThanOrEqual(1);
    expect(layout.footerBottom).toBeLessThanOrEqual(layout.bottom);
    expect(layout.horizontalOverflow).toBe(false);
    if (save) await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-monsters-picker.png`) });
    expect(downloads).toHaveLength(save ? 2 : 0);
    await picker.getByRole('button', { name: it.nextPage, exact: true }).click();
    await expect(picker.getByRole('searchbox')).toBeFocused();
    await picker.getByRole('searchbox').fill('goblin');
    await picker.getByRole('button', { name: 'monster_goblin_goblin.json', exact: true }).click();
    if (!save) {
      await expect(picker.getByRole('alert')).toContainText('503');
      await expect(picker.getByRole('searchbox')).toHaveValue('goblin');
      expect(await snapshot(page)).toEqual(before);
      await picker.getByRole('button', { name: 'monster_goblin_goblin.json', exact: true }).click();
    }
    const preview = page.getByRole('dialog', { name: it.catalogPreview, exact: true });
    await expect(preview.getByRole('listitem').filter({ hasText: 'Goblin · monster' })).toBeVisible();
    await expect(preview.locator('.error-text')).toHaveCount(0);
    if (!save) {
      await preview.getByRole('button', { name: it.cancel, exact: true }).click();
      expect(await snapshot(page)).toEqual(before);
    } else await preview.getByRole('button', { name: it.confirmImport, exact: true }).click();
    await expect(preview).not.toBeVisible();
  }
  const template = (await snapshot(page)).resources.find(r => r.catalogSource)!;
  expect(template.catalogSource?.original).toBe(original);
  await page.getByLabel(it.catalogFiles, { exact: true }).setInputFiles(catalogs);
  await page.getByRole('button', { name: it.confirmImport, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, /^Personaggi \d+$/);
  await page.getByRole('button', { name: it.newCharacter, exact: true }).first().click();
  await chooseManualGame(page.getByRole('combobox', { name: it.chooseSystem, exact: true }));
  await page.getByLabel('Nome del personaggio', { exact: true }).fill('QA mostri');
  await page.getByRole('combobox', { name: it.setupClass, exact: true }).selectOption({ label: 'Fighter' });
  await page.locator('select[name="setup-race"]').selectOption({ label: 'Human' });
  await page.locator('select[name="setup-background"]').selectOption({ label: 'Soldier' });
  await page.getByRole('button', { name: 'Crea personaggio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'QA mostri', exact: true })).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveText('Salvato sul dispositivo');
  for (const save of [false, true]) {
    const before = await snapshot(page);
    await page.getByRole('button', { name: 'Aggiungi risorsa · Companion', exact: true }).click();
    const companion = page.getByRole('dialog', { name: 'Aggiungi risorsa · Companion', exact: true });
    await companion.getByRole('textbox', { name: 'Name', exact: true }).fill('Compagno QA');
    await companion.getByRole('button', { name: 'Aggiungi risorsa · Monster', exact: true }).click();
    await page.getByRole('dialog', { name: 'Aggiungi risorsa · Monster', exact: true }).getByRole('button', { name: 'Goblin', exact: true }).click();
    await companion.getByRole('button', { name: save ? it.save : it.cancel, exact: true }).click();
    await expect(companion).not.toBeVisible();
    if (!save) expect(await snapshot(page)).toEqual(before);
  }
  await navigate(page, it.combat);
  await page.getByRole('textbox', { name: it.combatName, exact: true }).fill('Incontro QA mostri');
  await page.getByRole('button', { name: it.newCombat, exact: true }).click();
  await page.getByRole('combobox', { name: it.combatantType, exact: true }).selectOption({ label: 'Monster' });
  await page.getByRole('combobox', { name: it.combatantSource, exact: true }).selectOption({ label: 'Goblin' });
  for (const number of [1, 2]) {
    await page.getByRole('button', { name: it.addCombatant, exact: true }).click();
    await expect(page.getByRole('heading', { name: `Goblin #${number}`, exact: true })).toBeVisible();
  }
  await expect(page.getByTestId('save-status')).toHaveText('Salvato sul dispositivo');
  const saved = await snapshot(page), combatants = saved.combats[0].combatants;
  expect(new Set(combatants.map(f => f.templateId)).size).toBe(2);
  expect(combatants.every(f => f.templateId !== template.id && Number(f.overrides.current_hp) >= 2 && Number(f.overrides.current_hp) <= 12)).toBe(true);
  expect(saved.resources.find(r => r.id === template.id)?.catalogSource?.original).toBe(original);
  expect(saved.resources.filter(r => r.definitionId === 'monster' && !r.catalogSource)).toHaveLength(3);
  await page.locator('.combatant-card').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-monsters-combat.png`) });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true); await page.reload(); await navigate(page, it.combat);
  await expect(page.getByRole('heading', { name: 'Goblin #2', exact: true })).toBeVisible();
  expect(await snapshot(page)).toEqual(saved);
  expect(images).toEqual([]);
});

const catalogSystems = [
  { system: '5e', cases: [
    ['spell', 'spell_fireball.rpg.json', 'Fireball'],
    ['weapon', 'weapon_longsword.rpg.json', 'Longsword'],
    ['armor', 'armor_chain_mail.rpg.json', 'Chain mail'],
    ['item', 'item_hempen_rope_(50_feet).rpg.json', 'Hempen Rope (50 feet)']
  ] },
  { system: 'pf2e', cases: [
    ['monster', 'monster_goblin_warrior__b1_.rpg.json', 'Goblin Warrior'],
    ['spell', 'spell_fireball__pc1_.rpg.json', 'Fireball'],
    ['weapon', 'weapon_longsword__pc1_.rpg.json', 'Longsword'],
    ['armor', 'armor_breastplate__pc1_.rpg.json', 'Breastplate'],
    ['item', 'item_adventurer_s_pack__pc1_.rpg.json', 'Adventurer\'s Pack']
  ] }
] as const;

for (const { system, cases: rows } of catalogSystems) test(`real ${system} catalogs import one reviewed original per kind`, async ({ page }, info) => {
  const file = resolve(`.reference/official-releases-2026-11-16/${system}-system.rpg`);
  const folder = `systems/${system}/resource_instances/`;
  const cases = rows.map(([kind, name, title]) => ({ kind, name, title, label: it.dndCatalogKinds[kind],
    local: resolve('.reference/rpg-companion-app-systems/' + folder + name) }));
  test.skip(!existsSync(file) || cases.some(entry => !existsSync(entry.local)), `Local-only official ${system} catalog fixtures are absent`);
  const originals = new Map(cases.map(entry => [folder + entry.name, readFileSync(entry.local, 'utf8')]));
  const other = `systems/${system === '5e' ? 'pf2e' : '5e'}/resource_instances/spell_other.json`;
  const commit = '3'.repeat(40), tree = '4'.repeat(40), downloads: string[] = [];
  await page.route('https://api.github.com/repos/blastervla/rpg-companion-app-systems/**', route => route.fulfill({
    json: route.request().url().includes('/commits') ? [{ sha: commit, commit: { tree: { sha: tree } } }]
      : { sha: tree, truncated: false, tree: [...originals.keys(), other].map(path => ({
        path, size: Buffer.byteLength(originals.get(path) ?? '{}'), mode: '100644', type: 'blob'
      })) }
  }));
  await page.route('https://raw.githubusercontent.com/blastervla/rpg-companion-app-systems/**', route => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname.split(`/${commit}/`)[1]);
    downloads.push(path);
    return route.fulfill({ body: originals.get(path)!, contentType: 'application/json' });
  });
  await page.goto('./'); await navigate(page, it.systems);
  await page.getByLabel(it.localFile).setInputFiles(file);
  await page.getByRole('button', { name: it.confirmImport, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, it.resources); await openCatalogImport(page);
  for (const entry of cases) {
    await page.getByRole('button', { name: it.dndCatalogImport, exact: true }).click();
    const picker = page.getByRole('dialog', { name: it.dndCatalogImport, exact: true });
    await picker.getByRole('combobox', { name: it.dndCatalogKind, exact: true }).selectOption({ label: entry.label });
    await expect(picker.getByRole('button', { name: new RegExp(`^${entry.kind}_`) })).toHaveCount(1);
    if (entry.kind === 'item') await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-${system}-items-picker.png`) });
    await picker.getByRole('button', { name: entry.name, exact: true }).click();
    const preview = page.getByRole('dialog', { name: it.catalogPreview, exact: true });
    await expect(preview.getByRole('listitem').filter({ hasText: `${entry.title} · ${entry.kind}` })).toBeVisible();
    await expect(preview.locator('.error-text')).toHaveCount(0);
    await preview.getByRole('button', { name: it.confirmImport, exact: true }).click();
    await expect(preview).not.toBeVisible();
  }
  expect(downloads).toEqual(cases.map(entry => folder + entry.name));
  const imported = (await snapshot(page)).resources.filter(r => r.catalogSource);
  expect(imported.map(r => r.definitionId).sort()).toEqual(cases.map(entry => entry.kind).sort());
  for (const resource of imported) expect([...originals.values()]).toContain(resource.catalogSource?.original);
});
