/** @file Real 5e HP edits and bounded local Monster selection through production controls. */
import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { it } from '../../src/ui/it';
import { chooseManualGame } from './helpers';
import { verifyItemQuantity } from './resource-card-actions';
import { isResourceReference } from '../../src/domain/model';

async function setupValues(page: Page, existing = false, constitution = '14') {
  const dialog = page.getByRole('dialog');
  if (!existing) await chooseManualGame(dialog.getByRole('combobox', { name: it.chooseSystem, exact: true }));
  if (!existing) await dialog.getByLabel('Nome del personaggio').fill('Mira · configurata');
  await dialog.getByRole('combobox', { name: existing ? it.classChoice : it.setupClass, exact: true }).selectOption({ label: 'Fighter' });
  await dialog.locator('select[name="setup-race"]').selectOption({ label: 'Human' });
  await dialog.locator('select[name="setup-background"]').selectOption({ label: 'Soldier' });
  const fields = [['Forza', '16'], ['Destrezza', '16'], ['Costituzione', constitution],
    ...(existing ? [[it.setupBaseHp, '10'], [it.setupCurrentHp, '12']] : [])];
  for (const [name, value] of fields) {
    const input = dialog.getByRole('spinbutton', { name, exact: true });
    await input.fill(value); await input.press('Tab');
  }
}

async function setupSnapshot(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('sheetcore'); request.onsuccess = () => resolve(request.result);
    });
    const resources = await new Promise<import('../../src/domain/model').ResourceInstance[]>(resolve => {
      const request = database.transaction('resources').objectStore('resources').getAll(); request.onsuccess = () => resolve(request.result);
    });
    const characters = await new Promise<import('../../src/domain/model').Character[]>(resolve => {
      const request = database.transaction('characters').objectStore('characters').getAll(); request.onsuccess = () => resolve(request.result);
    });
    database.close();
    return { resourceCount: resources.length, characters, classes: resources.filter(r => r.definitionId === 'class_details'),
      feat: resources.find(r => r.definitionId === 'feat' && r.sourceId && r.catalogGroup) };
  });
}

async function expectSetupGeometry(page: Page, action = 'Crea personaggio') {
  const dialog = page.getByRole('dialog');
  const footer = await dialog.locator('.modal-actions').boundingBox();
  for (const scrollTop of [100000, 0]) {
    await dialog.locator('.source-form-fields').evaluate((element, top) => { element.scrollTop = top; }, scrollTop);
    const fields = (await dialog.locator('.source-form-fields').boundingBox())!;
    expect(fields.y + fields.height).toBeLessThanOrEqual(footer!.y);
    expect((await dialog.locator('.modal-actions').boundingBox())!.y).toBe(footer!.y);
    expect(await dialog.locator('.source-form').evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
  }
  await dialog.locator('.modal-actions').getByRole('button', { name: action, exact: true }).click({ trial: true });
}

async function expectConfigured(page: Page) {
  await expect(page.getByText('/ 12 HP', { exact: true })).toBeVisible();
  await expect(page.getByTestId('stat-armor_class')).toHaveText('13');
  await expect(page.getByTestId('stat-strength_saving_throw')).toHaveText('5');
  await expect(page.getByTestId('stat-constitution_saving_throw')).toHaveText('4');
  await expect(page.locator('[data-view-error]').filter({ hasText: /classes_hp_mods|classes_ac|when.*bool/ })).toHaveCount(0);
}

test('real 5e guided setup recovers an incomplete sheet, cancels cleanly, edits stat details and copies private feats', async ({ page, context }, info) => {
  const file = resolve('.reference/official-releases-2026-11-16/5e-system.rpg');
  const catalogs = ['class_fighter_fighter', 'class_wizard_wizard', 'race_human', 'background_soldier']
    .map(name => resolve(`.reference/rpg-companion-app-systems/systems/5e/resource_instances/${name}.rpg.json`));
  test.skip(!existsSync(file) || catalogs.some(file => !existsSync(file)), 'Local-only pinned 5e/catalog fixtures are absent');
  await page.goto('./'); await navigate(page, it.systems);
  await page.getByLabel(it.localFile).setInputFiles(file);
  await page.getByRole('button', { name: 'Conferma importazione', exact: true }).click();
  await navigate(page, 'Risorse');
  await page.getByLabel('File catalogo JSON', { exact: true }).setInputFiles(catalogs);
  await page.getByRole('button', { name: 'Conferma importazione', exact: true }).click();
  await navigate(page, /^Personaggi \d+$/);
  await page.getByRole('button', { name: 'Nuovo personaggio', exact: true }).first().click();
  await chooseManualGame(page.getByRole('combobox', { name: it.chooseSystem, exact: true }));
  await page.getByLabel('Nome del personaggio').fill('Mira · incompleta');
  await page.getByRole('button', { name: 'Crea personaggio', exact: true }).click();
  await expect(page.locator('[data-view-error]').filter({ hasText: 'max_hp: classes_hp_mods: max richiede una lista non vuota' }).first()).toBeVisible();
  await expect(page.locator('[data-view-error]').filter({ hasText: 'armor_class: classes_ac: max richiede una lista non vuota' })).toBeVisible();
  const before = await setupSnapshot(page);
  await page.getByRole('button', { name: it.characterSetup, exact: true }).click();
  await setupValues(page, true);
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  expect(await setupSnapshot(page)).toEqual(before);
  await page.getByRole('button', { name: it.characterSetup, exact: true }).click();
  await setupValues(page, true);
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expectConfigured(page);
  const eventBefore = await setupSnapshot(page);
  await page.getByRole('button', { name: 'INFORMATION', exact: true }).click();
  const information = page.getByRole('dialog', { name: 'About Mira · incompleta', exact: true });
  await expect(information).toBeVisible();
  await expect(information.getByText('Soldier', { exact: true })).toBeVisible();
  await expect(information.getByRole('spinbutton')).toHaveCount(0);
  await information.getByRole('button', { name: it.close, exact: true }).click();
  await page.getByTestId('stat-strength_modifier').locator('..').click();
  const rollResult = page.getByRole('dialog', { name: it.eventRollResults, exact: true });
  await expect(rollResult).toBeVisible();
  await expect(rollResult.getByText('Strength', { exact: true })).toBeVisible();
  await expect(rollResult).toContainText('1d20 + 3');
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-source-roll.png`) });
  await rollResult.getByRole('button', { name: it.close, exact: true }).click();
  expect(await setupSnapshot(page)).toEqual(eventBefore);
  await verifySourceActions(page, info.project.name);
  await page.getByTestId('stat-total_hit_dice').locator('..').click();
  const hitDice = page.getByRole('dialog', { name: 'Manage hit dice', exact: true });
  await hitDice.getByRole('spinbutton', { name: 'Modifica Hit Dice (d10)', exact: true }).fill('1');
  await hitDice.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(hitDice).not.toBeVisible();
  const prepared = await setupSnapshot(page);
  expect(prepared.characters[0].values.current_d10_hit_dice).toBe(1);
  expect(prepared.feat).toBeDefined();
  await page.getByRole('button', { name: 'Aggiungi risorsa · Feat', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Aggiungi risorsa · Feat', exact: true });
  await picker.getByRole('searchbox').fill(prepared.feat!.name);
  await picker.getByRole('button', { name: prepared.feat!.name, exact: true }).first().click();
  await expect(picker).not.toBeVisible();
  const copied = await setupSnapshot(page);
  expect(copied.resourceCount).toBe(prepared.resourceCount + 1);
  expect(copied.feat).toEqual(prepared.feat);
  expect(copied.characters[0].values.feats).toHaveLength(1);
  await verifySpellPicker(page, info.project.name);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: /Mira · incompleta/ }).click();
  await expectConfigured(page);
  await navigate(page, /^Personaggi \d+$/);
  await page.getByRole('button', { name: 'Nuovo personaggio', exact: true }).first().click();
  await setupValues(page);
  await verifyDraftInventory(page, info.project.name);
  await expect(page.getByLabel(it.setupAutoHp, { exact: true })).toBeChecked();
  await expect(page.getByRole('spinbutton', { name: it.setupBaseHp, exact: true })).toHaveCount(0);
  await page.getByLabel(it.setupAutoHp, { exact: true }).uncheck();
  const manualBase = page.getByRole('spinbutton', { name: it.setupBaseHp, exact: true });
  await manualBase.fill('99'); await manualBase.press('Tab');
  await page.getByLabel(it.setupAutoHp, { exact: true }).check();
  await expect(manualBase).toHaveCount(0);
  await expectSetupGeometry(page);
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-character-setup.png`) });
  await page.locator('.setup-health').scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-initial-health.png`) });
  await page.getByRole('button', { name: 'Crea personaggio', exact: true }).click();
  await expectConfigured(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-configured-sheet.png`) });
  expect((await setupSnapshot(page)).characters).toHaveLength(2);
  const created = (await setupSnapshot(page)).characters.find(character => character.name === 'Mira · configurata')!;
  const classReference = Array.isArray(created.values.classes) ? created.values.classes[0] : null;
  if (!isResourceReference(classReference)) throw new Error('Expected the configured character class reference');
  const classId = classReference.resourceId;
  expect(created.values.base_hp).toBe(10);
  expect(created.values.current_hp).toBe(12);
  expect(created.values.equipment).toHaveLength(1);
  await verifyItemQuantity(page);
  const beforeAdvancement = (await setupSnapshot(page)).characters.find(character => character.id === created.id);
  await page.getByRole('button', { name: it.progression, exact: true }).click();
  const advancement = page.getByRole('dialog', { name: it.progression, exact: true });
  await expect(advancement.getByRole('button', { name: it.progression, exact: true })).toBeDisabled();
  await expect(advancement.getByText(it.progressionChoices, { exact: true })).toBeVisible();
  await expect(advancement.getByText('Action Surge', { exact: true })).toBeVisible();
  const style = advancement.getByRole('group', { name: 'Fighting Style', exact: true });
  await style.getByRole('checkbox', { name: 'Archery', exact: true }).check();
  await expect(style.getByRole('checkbox', { name: 'Dueling', exact: true })).toBeDisabled();
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-progression.png`) });
  await advancement.getByRole('button', { name: it.cancel, exact: true }).click();
  expect((await setupSnapshot(page)).characters.find(character => character.id === created.id)).toEqual(beforeAdvancement);
  expect((await setupSnapshot(page)).classes.find(record => record.id === classId)!.values.selected_selectable_feature_ids).toEqual([]);
  await page.getByRole('button', { name: it.progression, exact: true }).click();
  await expect(style.getByRole('checkbox', { name: 'Archery', exact: true })).not.toBeChecked();
  await style.getByRole('checkbox', { name: 'Archery', exact: true }).check();
  await advancement.getByLabel(it.progressionAcknowledge, { exact: true }).check();
  await advancement.getByRole('button', { name: it.progression, exact: true }).click();
  await expect(advancement.getByRole('status')).toContainText(it.progressionSaved);
  expect((await setupSnapshot(page)).classes.find(record => record.id === classId)!.values.selected_selectable_feature_ids).toEqual(['archery1']);
  await expect(advancement.getByText('Action Surge', { exact: true })).toBeVisible();
  await expectSetupGeometry(page, it.close);
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-progression-result.png`) });
  await advancement.getByRole('button', { name: it.close, exact: true }).last().click();
  await expect(page.getByText('Human Fighter 2', { exact: true })).toBeVisible();
  await page.locator('summary').filter({ hasText: /^Fighter$/ }).click();
  await expect(page.getByText('Action Surge', { exact: true })).toBeVisible();
  const advanced = (await setupSnapshot(page)).characters.find(character => character.id === created.id)!;
  expect(advanced.values.current_hp).toBe(12);
  expect(Number(advanced.values.base_hp)).toBeGreaterThan(10);
  await page.reload();
  expect((await setupSnapshot(page)).characters.find(character => character.id === created.id)).toEqual(advanced);
  expect((await setupSnapshot(page)).classes.find(record => record.id === classId)!.values.selected_selectable_feature_ids).toEqual(['archery1']);
  await page.getByRole('button', { name: /Mira · configurata/ }).first().click();
  await expect(page.getByText('Human Fighter 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: it.progression, exact: true }).click();
  await advancement.getByLabel(it.progressionMulticlass, { exact: true }).check();
  await advancement.getByRole('combobox', { name: it.classChoice, exact: true }).selectOption({ label: 'Wizard' });
  await advancement.getByLabel(it.progressionAcknowledge, { exact: true }).check();
  await expect(advancement.getByRole('button', { name: it.progression, exact: true })).toBeDisabled();
  await advancement.getByLabel(it.progressionManual, { exact: true }).check();
  await advancement.getByRole('button', { name: it.progression, exact: true }).click();
  await expect(advancement.getByRole('status')).toContainText(`${it.classLevel}: 3`);
  await advancement.getByRole('button', { name: it.close, exact: true }).last().click();
  const multiclassed = (await setupSnapshot(page)).characters.find(character => character.id === created.id)!;
  expect(multiclassed.values.classes).toHaveLength(2);
  expect(multiclassed.values.current_hp).toBe(12);
  await navigate(page, /^Personaggi \d+$/);
  await page.getByRole('button', { name: 'Nuovo personaggio', exact: true }).first().click();
  await setupValues(page, false, '8');
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  expect((await setupSnapshot(page)).characters).toHaveLength(2);
  await page.getByRole('button', { name: 'Nuovo personaggio', exact: true }).first().click();
  await setupValues(page, false, '8');
  await page.getByRole('button', { name: 'Crea personaggio', exact: true }).click();
  await expect(page.getByText('/ 9 HP', { exact: true })).toBeVisible();
  const negative = (await setupSnapshot(page)).characters.filter(character => character.name === 'Mira · configurata')
    .find(character => character.values.constitution_score === 8)!;
  expect(negative.values.base_hp).toBe(9);
  expect(negative.values.current_hp).toBe(9);
  await page.reload();
  expect((await setupSnapshot(page)).characters.find(character => character.id === negative.id)?.values).toEqual(negative.values);
});

async function navigate(page: Page, name: string | RegExp) {
  const menu = page.getByRole('button', { name: 'Navigazione principale', exact: true });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  await page.locator('.sidebar').getByRole('button', { name, exact: true }).click();
}

async function verifySourceActions(page: Page, project: string) {
  const score = page.getByTestId('stat-acrobatics').first();
  await score.locator('..').click();
  const roll = page.getByRole('dialog', { name: it.eventRollResults, exact: true });
  await expect(roll).toContainText('1d20 + 3');
  await roll.getByRole('button', { name: it.close, exact: true }).click();
  const before = await setupSnapshot(page);
  await score.locator('..').click({ delay: 650 });
  const proficiency = page.getByRole('dialog', { name: 'Acrobatics', exact: true });
  await expect(proficiency).toBeVisible();
  await proficiency.getByRole('radio', { name: 'Proficient', exact: true }).check();
  await proficiency.getByRole('button', { name: it.cancel, exact: true }).click();
  expect(await setupSnapshot(page)).toEqual(before);
  await page.getByRole('button', { name: 'Azione pressione lunga · Acrobatics', exact: true }).first().click();
  await proficiency.getByRole('radio', { name: 'Proficient', exact: true }).check();
  await page.screenshot({ path: resolve(`.reference/ui-review/${project}-proficiency-edit.png`) });
  await proficiency.getByRole('button', { name: it.save, exact: true }).click();
  await expect(proficiency).not.toBeVisible();
  await expect(score).toHaveText('+5');
  expect((await setupSnapshot(page)).characters[0].values.acrobatics_proficiency).toBe('proficient');
  await page.getByRole('button', { name: 'Modifica · CP', exact: true }).click();
  const copper = page.getByRole('dialog', { name: 'Copper', exact: true });
  await copper.getByLabel(it.adjustmentAmount).fill('8');
  await copper.getByRole('button', { name: it.add, exact: true }).click();
  await expect(copper).not.toBeVisible();
  expect((await setupSnapshot(page)).characters[0].values.copper_pieces).toBe(8);
}

async function verifyDraftInventory(page: Page, project: string) {
  const setup = page.getByRole('dialog', { name: it.newCharacter, exact: true });
  const before = await setupSnapshot(page);
  const create = setup.getByRole('button', { name: 'Aggiungi risorsa · Item', exact: true });
  await create.click();
  const item = page.getByRole('dialog', { name: 'Aggiungi risorsa · Item', exact: true });
  await item.getByRole('textbox', { name: 'Name', exact: true }).fill('Corda annullata');
  await item.getByRole('button', { name: it.cancel, exact: true }).click();
  expect(await setupSnapshot(page)).toEqual(before);
  await create.click();
  await item.getByRole('textbox', { name: 'Name', exact: true }).fill('Corda manuale');
  await item.getByRole('textbox', { name: 'Name', exact: true }).press('Tab');
  await expect(item.locator('[data-view-error]')).toHaveCount(0);
  await page.screenshot({ path: resolve(`.reference/ui-review/${project}-inventory-create.png`) });
  await item.getByRole('button', { name: it.save, exact: true }).click();
  await expect(item).not.toBeVisible();
  expect(await setupSnapshot(page)).toEqual(before);
  await expect(setup.getByText('Corda manuale', { exact: true })).toBeVisible();
}

async function verifySpellPicker(page: Page, project: string) {
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('sheetcore');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const system = await new Promise<import('../../src/domain/model').StoredSystem>((resolve, reject) => {
      const request = database.transaction('systems').objectStore('systems').getAll();
      request.onsuccess = () => resolve(request.result[0]); request.onerror = () => reject(request.error);
    });
    const definition = system.definition.resources.find(r => r.id === 'spell')!;
    const defaults = Object.fromEntries(definition.stats.filter(s => s.type === 'base').map(s => [s.id, s.default_value ?? null]));
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction('resources', 'readwrite');
      for (const name of ['Fighter', 'Wizard']) tx.objectStore('resources').put({
        id: `spell-filter-${name}`, systemKey: system.key, definitionId: 'spell', name: `Local spell · ${name}`,
        values: { ...defaults, name: `Local spell · ${name}`, classes: [name] }
      });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    database.close();
  });
  await page.reload();
  await page.getByRole('button', { name: /Mira · incompleta/ }).click();
  await expect(page.locator('[data-view-error]').filter({ hasText: /notEquals|attuned_resources|all_weapons/ })).toHaveCount(0);
  const before = await setupSnapshot(page);
  const open = page.getByRole('button', { name: 'Aggiungi risorsa · Spell', exact: true });
  await open.click();
  const picker = page.getByRole('dialog', { name: 'Aggiungi risorsa · Spell', exact: true });
  await expect(picker.getByRole('checkbox', { name: 'Class: Fighter' })).toBeChecked();
  // The picker appends the source spell level, so the entry names carry a suffix.
  const fighter = picker.getByRole('button', { name: /^Local spell · Fighter / });
  await expect(fighter).toContainText('Trucchetto');
  await expect(picker.getByRole('button', { name: /^Local spell · Wizard / })).toHaveCount(0);
  await page.screenshot({ path: resolve(`.reference/ui-review/${project}-spell-filters.png`) });
  await picker.getByRole('checkbox', { name: 'Class: Fighter' }).uncheck();
  await expect(picker.getByRole('button', { name: /^Local spell · Wizard / })).toBeVisible();
  await picker.getByRole('button', { name: it.close, exact: true }).click();
  expect(await setupSnapshot(page)).toEqual(before);
  await open.click();
  await expect(picker.getByRole('checkbox', { name: 'Class: Fighter' })).toBeChecked();
  await fighter.click();
  await expect(picker).not.toBeVisible();
  const after = await setupSnapshot(page);
  expect(after.resourceCount).toBe(before.resourceCount + 1);
  expect(after.characters[0].values.spells).toHaveLength(1);
}

test('beginner D&D setup explains and applies point buy, dice and standard scores without partial writes', async ({ page }, info) => {
  const file = resolve('.reference/official-releases-2026-11-16/5e-system.rpg');
  test.skip(!existsSync(file), 'Local-only official 5e fixture is absent');
  await page.goto('./'); await navigate(page, it.systems);
  await page.getByLabel(it.localFile).setInputFiles(file);
  await page.getByRole('button', { name: 'Conferma importazione', exact: true }).click();
  await navigate(page, /^Personaggi \d+$/);
  await page.getByRole('button', { name: 'Nuovo personaggio', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await chooseManualGame(dialog.getByRole('combobox', { name: it.chooseSystem, exact: true }));
  await dialog.getByLabel('Nome del personaggio').fill('Primo eroe');
  await dialog.getByLabel(it.abilityMethod).selectOption('point');
  for (const name of it.abilityNames) await dialog.getByLabel(name, { exact: true }).selectOption('15');
  await expect(dialog.getByRole('button', { name: it.abilityApply })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Crea personaggio', exact: true })).toBeDisabled();
  for (const name of it.abilityNames.slice(3)) await dialog.getByLabel(name, { exact: true }).selectOption('8');
  await expect(dialog.getByRole('status').filter({ hasText: it.abilityRemaining })).toContainText('0 / 27');
  await dialog.getByLabel(it.abilityMethod).scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-beginner-point-buy.png`) });
  await dialog.getByRole('button', { name: it.abilityApply }).click();
  await dialog.getByLabel(it.abilityMethod).selectOption('dice');
  await expect(dialog.locator('.ability-rolls')).toHaveCount(0);
  await dialog.getByRole('button', { name: it.abilityRoll }).click();
  await expect(dialog.locator('.ability-rolls li')).toHaveCount(6);
  await expect(dialog.locator('.ability-rolls del')).toHaveCount(6);
  for (let i = 0; i < 6; i++) await dialog.getByLabel(it.abilityNames[i], { exact: true }).selectOption(String(i));
  await dialog.getByRole('button', { name: it.abilityApply }).click();
  await dialog.getByRole('button', { name: 'Annulla', exact: true }).click();
  expect((await setupSnapshot(page)).characters).toHaveLength(0);
  await page.getByRole('button', { name: 'Nuovo personaggio', exact: true }).first().click();
  await chooseManualGame(dialog.getByRole('combobox', { name: it.chooseSystem, exact: true }));
  await dialog.getByLabel('Nome del personaggio').fill('Primo eroe');
  await dialog.getByLabel(it.abilityMethod).selectOption('standard');
  for (let i = 0; i < 6; i++) await dialog.getByLabel(it.abilityNames[i], { exact: true }).selectOption(String(i));
  await dialog.getByRole('button', { name: it.abilityApply }).click();
  await dialog.getByRole('button', { name: 'Crea personaggio', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const saved = (await setupSnapshot(page)).characters[0];
  expect(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(id => saved.values[`${id}_score`]))
    .toEqual([15, 14, 13, 12, 10, 8]);
  await page.reload();
  expect((await setupSnapshot(page)).characters[0].values).toEqual(saved.values);
});

test('real 5e HP and paged Monster selection retain atomic save, cancel and offline data', async ({ page, context }, info) => {
  const file = resolve('.reference/official-releases-2026-11-16/5e-system.rpg');
  test.skip(!existsSync(file), 'Local-only official 5e fixture is absent');
  await page.goto('./');
  await navigate(page, it.systems);
  await page.getByLabel(it.localFile).setInputFiles(file);
  await page.getByRole('button', { name: 'Conferma importazione', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, /^Personaggi \d+$/);
  await page.getByRole('button', { name: 'Nuovo personaggio', exact: true }).first().click();
  await chooseManualGame(page.getByRole('combobox', { name: it.chooseSystem, exact: true }));
  await page.getByLabel('Nome del personaggio').fill('Mira · verifica HP');
  await page.getByRole('button', { name: 'Crea personaggio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mira · verifica HP', exact: true })).toBeVisible();
  // Generated local instances exercise the archive limit, not an external Monster compendium.
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('sheetcore');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const system = await new Promise<import('../../src/domain/model').StoredSystem>((resolve, reject) => {
      const request = database.transaction('systems').objectStore('systems').getAll();
      request.onsuccess = () => resolve(request.result[0]); request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(['resources', 'characters'], 'readwrite');
      for (const id of ['class', 'class_details']) {
        const definition = system.definition.resources.find(d => d.id === id)!;
        const values = Object.fromEntries(definition.stats.filter(s => s.type === 'base').map(s => [s.id, s.default_value ?? null]));
        if (id === 'class') values.name = 'Manual test class';
        else values.class = { resourceId: 'test-class' };
        tx.objectStore('resources').put({ id: `test-${id}`, systemKey: system.key, definitionId: id, name: id, values });
      }
      for (let i = 0; i < 9996; i++) tx.objectStore('resources').put({
        id: `monster-${i}`, systemKey: system.key, definitionId: 'monster',
        name: `Monster ${String(i).padStart(5, '0')}`, values: { name: `Monster ${String(i).padStart(5, '0')}` }
      });
      const request = tx.objectStore('characters').getAll();
      request.onsuccess = () => {
        const character = request.result[0];
        character.values.classes = [{ resourceId: 'test-class_details' }];
        tx.objectStore('characters').put(character);
      };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    database.close();
  });
  await page.reload();
  await page.getByRole('button', { name: /Mira · verifica HP/ }).click();
  await expect(page.getByText('/ 1 HP', { exact: true })).toBeVisible();
  for (let value = 2; value <= 4; value++) {
    await page.getByRole('button', { name: 'Aumenta Current HP', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Modifica Current HP', exact: true })).toHaveText(String(value));
    await expect(page.getByTestId('save-status')).toHaveText('Salvato sul dispositivo');
  }
  const navigation = page.getByRole('navigation', { name: 'Sezioni della scheda' });
  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', { name: 'Valori base', exact: true }).click();
  const editor = page.locator('#sheet-base-values');
  await editor.locator('summary').click();
  await editor.getByRole('searchbox').fill('current_hp');
  await expect(editor.getByRole('spinbutton', { name: 'Current HP', exact: true })).toHaveValue('4');
  await editor.getByRole('spinbutton').fill('5');
  await editor.getByRole('spinbutton').press('Tab');
  await expect(page.getByTestId('save-status')).toHaveText('Salvato sul dispositivo');
  await editor.locator('summary').click();
  await page.getByRole('button', { name: 'Aggiungi risorsa · Companion', exact: true }).click();
  const companion = page.getByRole('dialog', { name: 'Aggiungi risorsa · Companion', exact: true });
  await companion.getByRole('textbox', { name: 'Name', exact: true }).fill('Compagno di Mira');
  for (let attempt = 0; attempt < 2; attempt++) {
    await companion.getByRole('button', { name: 'Aggiungi risorsa · Monster', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Aggiungi risorsa · Monster', exact: true });
    await expect(picker.getByRole('button', { name: /^Monster \d/ })).toHaveCount(50);
    await picker.getByRole('button', { name: 'Pagina successiva' }).click();
    // The picker sorts by name: Monster 00050 opens page 2.
    await expect(picker.getByRole('button', { name: 'Monster 00050', exact: true })).toBeVisible();
    await expect(picker.getByRole('searchbox')).toBeFocused();
    const heading = await picker.locator('.modal-heading').boundingBox();
    await picker.locator('.modal-body').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(picker.getByRole('button', { name: 'Chiudi', exact: true })).toBeVisible();
    expect((await picker.locator('.modal-heading').boundingBox())!.y).toBe(heading!.y);
    await picker.getByRole('searchbox').fill('09995');
    await expect(picker.getByRole('button', { name: /^Monster \d/ })).toHaveCount(1);
    if (attempt === 0) {
      await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-monster-picker.png`) });
      await picker.getByRole('button', { name: 'Chiudi', exact: true }).click();
    } else await picker.getByRole('button', { name: 'Monster 09995', exact: true }).click();
    await expect(picker).not.toBeVisible();
  }
  await companion.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(companion).not.toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveText('Salvato sul dispositivo');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: /Mira · verifica HP/ }).click();
  await expect(page.getByRole('button', { name: 'Modifica Current HP', exact: true })).toHaveText('5');
  // This source explicitly disables Details; its declared inline name input retains the saved value.
  await expect(page.locator('.source-resource-item').getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Compagno di Mira');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-5e-sheet.png`) });
  const data = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('sheetcore'); request.onsuccess = () => resolve(request.result);
    });
    const resources = await new Promise<import('../../src/domain/model').ResourceInstance[]>(resolve => {
      const request = database.transaction('resources').objectStore('resources').getAll(); request.onsuccess = () => resolve(request.result);
    });
    database.close();
    return resources;
  });
  expect(data).toHaveLength(10000);
  const saved = data.find(r => r.definitionId === 'companion')!;
  expect(saved.values.name).toBe('Compagno di Mira');
  const reference = saved.values.monster as { resourceId: string };
  expect(reference.resourceId).not.toBe('monster-9995');
  expect(data.find(r => r.id === reference.resourceId)?.name).toBe('Monster 09995');
  expect(data.find(r => r.id === 'monster-9995')?.values.name).toBe('Monster 09995');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
