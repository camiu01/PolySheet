/** @file Imported 5e equipment and spells reach real draft/setup and sheet controls without template mutation. */
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { it } from '../../src/ui/it';
import { chooseManualGame, openCatalogImport } from './helpers';

async function navigate(page: Page, name: string | RegExp) {
  const menu = page.getByRole('button', { name: 'Navigazione principale', exact: true });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  await page.locator('.sidebar').getByRole('button', { name, exact: true }).click();
}
async function state(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('sheetcore');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const tx = database.transaction(['characters', 'resources']);
    const [characters, resources] = await Promise.all(['characters', 'resources'].map(store =>
      new Promise<unknown[]>((resolve, reject) => {
        const request = tx.objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      })));
    database.close(); return { characters, resources };
  });
}

test('real 5e inventory drafts cancel, then equipment and a spell save and reopen offline', async ({ page, context }, info) => {
  const file = resolve('.reference/official-releases-2026-11-16/5e-system.rpg');
  const folder = '.reference/rpg-companion-app-systems/systems/5e/resource_instances/';
  const names = ['class_fighter_fighter', 'race_human', 'background_soldier', 'spell_magic_missile',
    'weapon_longsword', 'armor_leather', 'item_torch'];
  const catalogs = names.map(name => resolve(folder + name + '.rpg.json'));
  test.skip(!existsSync(file) || catalogs.some(path => !existsSync(path)), 'Local-only official 5e fixtures are absent');
  await page.goto('./'); await navigate(page, it.systems);
  await page.getByLabel(it.localFile).setInputFiles(file);
  await page.getByRole('button', { name: it.confirmImport, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, it.resources); await openCatalogImport(page);
  await page.getByLabel(it.catalogFiles, { exact: true }).setInputFiles(catalogs);
  await page.getByRole('button', { name: it.confirmImport, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const before = await state(page);
  await navigate(page, /^Personaggi \d+$/);
  for (const save of [false, true]) {
    await page.getByRole('button', { name: it.newCharacter, exact: true }).first().click();
    const setup = page.getByRole('dialog', { name: it.newCharacter, exact: true });
    await chooseManualGame(setup.getByRole('combobox', { name: it.chooseSystem, exact: true }));
    await setup.getByLabel('Nome del personaggio', { exact: true }).fill('QA cataloghi');
    await setup.getByRole('combobox', { name: it.setupClass, exact: true }).selectOption({ label: 'Fighter' });
    await setup.locator('select[name="setup-race"]').selectOption({ label: 'Human' });
    await setup.locator('select[name="setup-background"]').selectOption({ label: 'Soldier' });
    for (const [type, name] of [['Weapon', 'Longsword'], ['Armor', 'Leather'], ['Item', 'Torch']]) {
      await setup.getByRole('button', { name: `Aggiungi risorsa · ${type}`, exact: true }).click();
      await page.getByRole('dialog', { name: `Aggiungi risorsa · ${type}`, exact: true })
        .getByRole('button', { name, exact: true }).click();
      await expect(setup.getByText(name, { exact: true }).first()).toBeVisible();
    }
    expect(await state(page)).toEqual(before);
    if (save) await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-catalog-inventory-draft.png`) });
    await setup.getByRole('button', { name: save ? 'Crea personaggio' : it.cancel, exact: true }).click();
    await expect(setup).not.toBeVisible();
    if (!save) expect(await state(page)).toEqual(before);
  }
  await expect(page.getByRole('heading', { name: 'QA cataloghi', exact: true })).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveText(it.saved);
  await page.getByRole('button', { name: 'Aggiungi risorsa · Spell', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Aggiungi risorsa · Spell', exact: true });
  await picker.getByRole('checkbox', { name: 'Class: Fighter', exact: true }).uncheck();
  await picker.getByRole('button', { name: 'Magic Missile', exact: true }).click();
  await expect(picker).not.toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveText(it.saved);
  const saved = await state(page);
  const characters = saved.characters as { values: Record<string, unknown[]> }[];
  for (const field of ['weapons', 'armors', 'equipment', 'spells']) expect(characters[0].values[field]).toHaveLength(1);
  const templates = saved.resources as { catalogSource?: { original: string } }[];
  expect(templates.filter(resource => resource.catalogSource).map(resource => resource.catalogSource!.original).sort())
    .toEqual(catalogs.map(path => readFileSync(path, 'utf8')).sort());
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true); await page.reload();
  expect(await state(page)).toEqual(saved);
});
