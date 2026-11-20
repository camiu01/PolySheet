/** @file 5e Bard Optional Features left open at level up, then chosen and saved from the feature card on the sheet. */
import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Character, ResourceInstance } from '../../src/domain/model';
import { it } from '../../src/ui/it';
import { chooseManualGame, openCatalogImport } from './helpers';

async function navigate(page: Page, name: string | RegExp) {
  const menu = page.getByRole('button', { name: 'Navigazione principale', exact: true });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  await page.locator('.sidebar').getByRole('button', { name, exact: true }).click();
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('sheetcore');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const all = <T,>(store: string) => new Promise<T[]>((resolve, reject) => {
      const request = database.transaction(store).objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const [characters, resources] = await Promise.all([all<Character>('characters'), all<ResourceInstance>('resources')]);
    database.close(); return { character: characters[0], resources };
  });
}

/** The class features group and the card's choice section start collapsed on the sheet. */
async function openBardCard(page: Page, shot?: string) {
  const group = page.locator('summary').filter({ hasText: /^Bard$/ });
  if (await group.locator('xpath=..').getAttribute('open') === null) await group.click();
  if (shot) await group.locator('xpath=ancestor::*[contains(@class,"sheet-section")][1]').screenshot({ path: shot });
  await page.getByRole('button', { name: 'Dettagli · Bard Optional Features', exact: true }).click();
  const choices = page.getByRole('dialog', { name: 'Bard Optional Features', exact: true })
    .locator('summary').filter({ hasText: 'Chosen selectable features' });
  if (await choices.locator('xpath=..').getAttribute('open') === null) await choices.click();
}

test('Bard Optional Features open after level up are chosen and saved from the sheet card', async ({ page }, info) => {
  const file = resolve('.reference/official-releases-2026-11-16/5e-system.rpg');
  const folder = '.reference/rpg-companion-app-systems/systems/5e/resource_instances/';
  const catalogs = ['class_bard_bard', 'race_dwarf_dwarf', 'background_acolyte'].map(name => resolve(folder + name + '.rpg.json'));
  test.skip(!existsSync(file) || catalogs.some(f => !existsSync(f)), 'Local-only official 5e fixtures are absent');
  await page.goto('./'); await navigate(page, it.systems);
  await page.getByLabel(it.localFile).setInputFiles(file);
  await page.getByRole('button', { name: it.confirmImport, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, it.resources); await openCatalogImport(page);
  await page.getByLabel(it.catalogFiles, { exact: true }).setInputFiles(catalogs);
  await page.getByRole('button', { name: it.confirmImport, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, /^Personaggi \d+$/);
  await page.getByRole('button', { name: it.newCharacter, exact: true }).first().click();
  await chooseManualGame(page.getByRole('combobox', { name: it.chooseSystem, exact: true }));
  await page.getByLabel('Nome del personaggio', { exact: true }).fill('QA bardo');
  await page.getByRole('combobox', { name: it.setupClass, exact: true }).selectOption({ label: 'Bard' });
  await page.locator('select[name="setup-race"]').selectOption({ label: 'Dwarf' });
  await page.locator('select[name="setup-background"]').selectOption({ label: 'Acolyte' });
  await page.getByRole('button', { name: 'Crea personaggio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'QA bardo', exact: true })).toBeVisible();

  await page.getByRole('button', { name: it.progression, exact: true }).click();
  const advance = page.getByRole('dialog', { name: it.progression, exact: true });
  await advance.getByRole('button', { name: it.progressionNext(2), exact: true }).click();
  await expect(advance.getByRole('group', { name: 'Bard Optional Features', exact: true })).toBeVisible();
  await advance.getByLabel(it.progressionAcknowledge, { exact: true }).check();
  await advance.getByRole('button', { name: it.progression, exact: true }).last().click();
  await expect(advance.getByRole('heading', { name: it.progressionOpenChoices, exact: true })).toBeVisible();
  await expect(advance).toContainText(it.progressionOpenChoicesHelp);
  await advance.getByRole('button', { name: it.close, exact: true }).first().click();

  const traits = page.locator('summary').filter({ hasText: /^Racial traits$/ });
  if (await traits.locator('xpath=..').getAttribute('open') === null) await traits.click();
  await traits.locator('xpath=..').screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-racial-traits.png`) });
  await openBardCard(page, resolve(`.reference/ui-review/${info.project.name}-bard-features.png`));
  const card = page.getByRole('dialog', { name: 'Bard Optional Features', exact: true });
  await expect(card.getByText(`${it.unsupported}: markdown`)).toHaveCount(0);
  const option = card.getByRole('checkbox', { name: 'Magic Inspiration', exact: true });
  await expect(option).not.toBeChecked();
  await option.check();
  if (info.project.name === 'mobile') await page.screenshot({ path: resolve('.reference/ui-review/mobile-bard-optional-features.png') });
  await card.getByRole('button', { name: 'SAVE', exact: true }).click();
  await expect(page.getByRole('dialog', { name: it.eventApplied, exact: true })).toContainText(it.eventAppliedHelp);
  const { character, resources } = await stored(page);
  const wrapper = resources.find(record => record.id === (character.values.classes as { resourceId: string }[])[0].resourceId)!;
  expect(wrapper.values.selected_selectable_feature_ids).toEqual(['magic_inspiration']);
  // Feature descriptions are source markdown, shown as text rather than an unsupported note.
  await page.getByRole('dialog', { name: it.eventApplied, exact: true }).getByRole('button', { name: 'Chiudi', exact: true }).click();
  await card.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await page.getByRole('button', { name: 'Dettagli · Jack of All Trades', exact: true }).click();
  const jack = page.getByRole('dialog', { name: 'Jack of All Trades', exact: true });
  await expect(jack.locator('.markdown')).toContainText('half your proficiency bonus, rounded down');
  await page.reload();
  await page.getByRole('button', { name: /QA bardo/ }).click();
  await openBardCard(page);
  await expect(page.getByRole('dialog', { name: 'Bard Optional Features', exact: true })
    .getByRole('checkbox', { name: 'Magic Inspiration', exact: true })).toBeChecked();
});
