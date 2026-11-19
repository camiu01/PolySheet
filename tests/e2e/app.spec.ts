/**
 * @file Real browser acceptance, including service-worker offline navigation.
 * @remarks URL fixtures are intercepted locally unless LIVE_RPG_IMPORT=1 opts
 * into the pinned public raw-file check. No remote writes or account APIs.
 */
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { demo, demoOriginal } from '../../src/demo';
import { base, capabilitySystem, constant, list, stat } from '../fixtures/capabilities';
import { chooseGame, openCatalogImport } from './helpers';
import { viewSystem } from '../fixtures/views';
import { it as copy } from '../../src/ui/it';
import { catalogSystem, classOriginal, raceOriginal, backgroundOriginal, subraceOriginal } from '../fixtures/catalog';

async function navigate(page: Page, label: string) {
  const menu = page.getByRole('button', { name: 'Navigazione principale', exact: true });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  const all = page.locator('.sidebar');
  await all.getByRole('button', { name: label === 'Personaggi' ? /^Personaggi \d+$/ : label, exact: true }).click();
}
async function importJson(page: Page, text: string, confirm = true) {
  await navigate(page, copy.systems);
  await page.locator('input[type=file]').setInputFiles({ name: 'system.rpg.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.getByRole('dialog')).toBeVisible();
  if (confirm) {
    await page.getByRole('button', { name: 'Conferma importazione' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
}
async function create(page: Page, name: string, systemKey?: string) {
  await navigate(page, 'Personaggi');
  await page.getByRole('button', { name: 'Nuovo personaggio', exact: true }).first().click();
  const game = page.getByRole('combobox', { name: copy.chooseSystem, exact: true });
  if (systemKey) await game.selectOption(systemKey);
  else await chooseGame(game);
  // Systems with source creation pages open the guided flow; these tests exercise manual setup.
  const manual = page.getByText(copy.manual, { exact: true });
  const useManual = page.getByRole('button', { name: copy.useManualSetup, exact: true });
  await expect(manual.or(useManual)).toBeVisible();
  if (await useManual.isVisible()) {
    // The guided flow keeps its actions in view: only its fields scroll (desktop and mobile).
    const next = page.getByRole('dialog').getByRole('button', { name: copy.next, exact: true });
    if (await next.count()) {
      await expect(next).toBeInViewport({ ratio: 1 });
      await page.locator('.creation-flow > .source-form > .source-form-fields').evaluate(node => { node.scrollTop = node.scrollHeight; });
      await expect(next).toBeInViewport({ ratio: 1 });
    }
    await useManual.click();
  }
  await expect(manual).toBeVisible();
  await page.getByLabel('Nome del personaggio').fill(name);
  await page.getByRole('button', { name: 'Crea personaggio', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true, level: 1 })).toBeVisible();
}
async function waitForWorker(page: Page, expectedStatus: string = copy.saved) {
  await expect(page.getByTestId('save-status')).toHaveText(expectedStatus);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}
async function captureInterface(page: Page, name: string) {
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.screenshot({ path: resolve(`.reference/ui-review/${name}.png`), animations: 'disabled' });
}

test('nested resource previews read the live selection, cancel without writes and reopen offline', async ({ page, context }, info) => {
  const source = { ...demo, character_stats: [...demo.character_stats, base('origin', 'resource', null)],
    resources: [{ id: 'origin', name: 'Origine locale', core: false, display_name: 'name',
      stats: [base('name', 'string', '')],
      edit_view: { id: 'origin-edit', type: 'text', edit_stat: 'name', label: constant('Nome origine') },
      display_view: { id: 'origin-display', type: 'text', text: stat('name') }
    }],
    character_sheet_sections: [{ id: 'origin-section', view: {
      id: 'origin-popup', type: 'popUpButton', text: constant('Modifica origine'), pop_up_title: constant('Origine'),
      display_save_button: true, should_persist_on_save: true,
      pop_up_view: { id: 'origin-form', type: 'list', subviews: [
        { id: 'origin-choice', type: 'selectResources', stat: 'origin', resource_id: 'origin', create_in_place: true },
        { id: 'origin-details', type: 'popUpButton', text: constant('Anteprima origine'), pop_up_title: constant('Dettaglio origine'),
          display_save_button: false, display_cancel_button: true, cancel_text: constant('OK'),
          pop_up_view: { id: 'origin-preview', type: 'resource', resource_id: 'origin',
            stat: '$view.origin-choice', view_type: 'display', create_if_empty: false } }
      ] }
    } }]
  };
  await page.goto('./'); await importJson(page, JSON.stringify(source)); await create(page, 'Scoped preview');
  async function choose(name: string) {
    await page.getByRole('button', { name: 'Modifica origine', exact: true }).click();
    await page.getByRole('button', { name: 'Aggiungi risorsa · Origine locale', exact: true }).click();
    const creation = page.getByRole('dialog', { name: 'Aggiungi risorsa · Origine locale', exact: true });
    await creation.getByLabel('Nome origine', { exact: true }).fill(name);
    await creation.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(creation).not.toBeVisible();
    await page.getByRole('button', { name: 'Anteprima origine', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Dettaglio origine', exact: true });
    await expect(preview.getByText(name, { exact: true })).toBeVisible();
    await expect(preview.locator('[data-view-error],.unsupported-note')).toHaveCount(0);
    return preview;
  }
  const draft = await choose('Solo bozza');
  await page.screenshot({ path: resolve(`.reference/ui-review/${info.project.name}-scoped-resource-preview.png`) });
  await draft.getByRole('button', { name: 'OK', exact: true }).click();
  await page.getByRole('dialog', { name: 'Origine', exact: true }).getByRole('button', { name: 'Annulla', exact: true }).click();
  const saved = await choose('Origine salvata');
  await saved.getByRole('button', { name: 'OK', exact: true }).click();
  await page.getByRole('dialog', { name: 'Origine', exact: true }).getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await waitForWorker(page); await context.setOffline(true); await page.reload();
  await navigate(page, 'Personaggi');
  await page.getByRole('button', { name: /Scoped preview/ }).click();
  await page.getByRole('button', { name: 'Modifica origine', exact: true }).click();
  await page.getByRole('button', { name: 'Anteprima origine', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Dettaglio origine', exact: true });
  await expect(preview.getByText('Origine salvata', { exact: true })).toBeVisible();
  await preview.getByRole('button', { name: 'OK', exact: true }).click();
  await page.getByRole('dialog', { name: 'Origine', exact: true }).getByRole('button', { name: 'Annulla', exact: true }).click();
  await navigate(page, 'Risorse');
  await expect(page.getByRole('heading', { name: 'Solo bozza', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Origine salvata', exact: true })).toBeVisible();
});

test('reported original HP, AC and description recover with manual class and race resources', async ({ page, context }) => {
  const file = resolve('.reference/reported-system.rpg');
  test.skip(!existsSync(file), 'Local-only user-provided HP reproduction fixture is absent');
  await page.goto('./');
  await navigate(page, copy.systems);
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByRole('button', { name: 'Conferma importazione', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await create(page, 'HP manuale');
  await expect(page.locator('[data-view-error]').filter({ hasText: 'max_hp: classes_hp_mods: max richiede una lista non vuota' }).first()).toBeVisible();
  await expect(page.locator('[data-view-error]').filter({ hasText: 'armor_class: classes_ac: max richiede una lista non vuota' })).toBeVisible();
  await expect(page.locator('[data-view-error]').filter({ hasText: 'Statistica mancante nel percorso: race.name' })).toBeVisible();
  await expect(page.getByText('Statistica mancante: $edit_mode', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Non supportato: menuButton', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Non supportato: bottom_left_button_event', { exact: true })).toBeVisible();
  await expect(page.getByText(/Non supportato: .*bottom_right_button_event/)).toHaveCount(0);
  await page.locator('.source-avatar-section').getByRole('button', { name: 'Menu della sorgente', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Long rest', exact: true }).click();
  await expect(page.getByText(/Azione non ancora disponibile in PolySheet.*trigger_long_rest/)).toBeVisible();
  await navigate(page, 'Risorse');
  for (const [definitionId, archiveName] of [['class', 'Classe manuale'], ['class_details', 'Dettagli classe manuale'], ['race', 'Razza manuale']]) {
    await page.getByRole('button', { name: 'Nuova risorsa locale', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Tipo di risorsa').selectOption(definitionId);
    await dialog.getByRole('button', { name: 'Apri editor manuale dei valori base', exact: true }).click();
    await dialog.getByLabel('Nome nell’archivio').fill(archiveName);
    if (definitionId !== 'class_details') {
      await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill(archiveName);
      await dialog.getByRole('textbox', { name: 'Name', exact: true }).press('Tab');
    } else {
      await dialog.getByRole('combobox', { name: 'Class', exact: true }).selectOption({ label: 'Classe manuale · class' });
      await dialog.getByRole('spinbutton', { name: 'Class level', exact: true }).fill('2');
      await dialog.getByRole('spinbutton', { name: 'Class level', exact: true }).press('Tab');
    }
    await dialog.getByRole('button', { name: 'Salva risorsa', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('heading', { name: archiveName, exact: true })).toBeVisible();
  }
  await navigate(page, 'Personaggi');
  await page.getByRole('button', { name: /HP manuale/ }).click();
  const editor = page.locator('details.base-editor').filter({ has: page.locator('summary', { hasText: 'Valori base · modifica manuale' }) });
  await editor.locator('summary').click();
  const assignedClass = editor.getByRole('group', { name: 'Classes', exact: true })
    .getByRole('checkbox', { name: 'Dettagli classe manuale · class_details', exact: true });
  await assignedClass.click();
  await expect(assignedClass).toBeChecked();
  const assignedRace = editor.getByRole('combobox', { name: 'Race', exact: true });
  await assignedRace.selectOption({ label: 'Razza manuale · race' });
  await expect(assignedRace).not.toHaveValue('');
  await editor.getByRole('spinbutton', { name: 'Dexterity', exact: true }).fill('14');
  await editor.getByRole('spinbutton', { name: 'Dexterity', exact: true }).press('Tab');
  await editor.getByRole('spinbutton', { name: 'Constitution', exact: true }).fill('14');
  await editor.getByRole('spinbutton', { name: 'Constitution', exact: true }).press('Tab');
  await editor.getByRole('spinbutton', { name: 'Base HP', exact: true }).fill('10');
  await editor.getByRole('spinbutton', { name: 'Base HP', exact: true }).press('Tab');
  await expect(page.getByText('/ 14 HP', { exact: true })).toBeVisible();
  await expect(page.getByTestId('stat-armor_class')).toHaveText('12');
  await expect(page.getByText('Razza manuale Classe manuale 2', { exact: true })).toBeVisible();
  await expect(page.locator('[data-view-error]').filter({ hasText: /armor_class:|race.name/ })).toHaveCount(0);
  await expect(page.locator('[data-view-error]').filter({ hasText: 'max_hp: classes_hp_mods:' })).toHaveCount(0);
  await waitForWorker(page);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: /HP manuale/ }).click();
  await expect(page.getByText('/ 14 HP', { exact: true })).toBeVisible();
  await expect(page.getByTestId('stat-armor_class')).toHaveText('12');
  await expect(page.getByText('Razza manuale Classe manuale 2', { exact: true })).toBeVisible();
  await navigate(page, 'Impostazioni');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta backup', exact: true }).click();
  const backup = readFileSync((await (await download).path())!, 'utf8');
  const data = JSON.parse(backup);
  expect(data.resources).toHaveLength(3);
  expect(data.characters[0].values.classes).toHaveLength(1);
  expect(Buffer.from(data.systems[0].artifact.base64, 'base64')).toEqual(readFileSync(file));
  await page.locator('input[type=file]').setInputFiles({ name: 'manual-hp.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByRole('button', { name: 'Sostituisci archivio', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: /HP manuale/ }).click();
  await expect(page.getByText('/ 14 HP', { exact: true })).toBeVisible();
  await expect(page.getByTestId('stat-armor_class')).toHaveText('12');
  await expect(page.getByText('Razza manuale Classe manuale 2', { exact: true })).toBeVisible();
});

test('avatar corner menu stays inside the viewport and accepts pointer selection', async ({ page }) => {
  const source = { ...demo,
    enumerated_types: [{ id: 'local-menu', name: 'Menu locale', types: [{ id: 'rest', name: 'Riposo locale' }] }],
    character_sheet_sections: [{ id: 'portrait', view: { id: 'portrait-view', type: 'avatarSection',
      center_content: [], bottom_right_stack: [{ id: 'corner-menu', type: 'menuButton', options: 'local-menu' }]
    } }]
  };
  await page.goto('./');
  await importJson(page, JSON.stringify(source));
  await create(page, 'Menu locale');
  await page.getByRole('button', { name: 'Menu della sorgente', exact: true }).click();
  const menu = page.getByRole('menu');
  const bounds = await menu.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  await page.getByRole('menuitem', { name: 'Riposo locale', exact: true }).click();
  await expect(menu).not.toBeVisible();
  await expect(page.getByText(/Azione non ancora disponibile in PolySheet.*rest/)).toBeVisible();
});

test('production assets, manifest and offline worker retain the deployment subpath', async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error('Production acceptance requires a baseURL');
  const path = new URL(baseURL).pathname;
  await page.goto('./');
  expect(new URL(page.url()).pathname).toBe(path);
  const response = await page.request.get(new URL('manifest.webmanifest', baseURL).href);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(new URL(manifest.start_url, response.url()).pathname).toBe(path);
  expect(new URL(manifest.scope, response.url()).pathname).toBe(path);
  await waitForWorker(page);
  const worker = await page.evaluate(async () => ({
    scope: new URL((await navigator.serviceWorker.ready).scope).pathname,
    script: new URL(navigator.serviceWorker.controller!.scriptURL).pathname
  }));
  expect(worker).toEqual({ scope: path, script: `${path}sw.js` });
  await context.setOffline(true);
  await page.reload();
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await expect(page.getByRole('heading', { name: 'La prossima storia inizia qui.' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(path);
});

test('collection formulas recalculate through real inputs and offline reopening', async ({ page, context }) => {
  const yesNo = (condition: unknown) => ({ type: 'when', clauses: [
    { condition, components: constant('si') }, { condition: constant(true), components: constant('no') }
  ] });
  const source = { ...demo, character_sheet_sections: [...demo.character_sheet_sections, {
    id: 'collection-check', view: { id: 'collection-result', type: 'text', text: {
      type: 'concat', components: list(
        { type: 'joinToString', separator: ',', components: { type: 'sortBy', order: 'asc',
          components: { type: 'flatMap', components: list(constant(3), constant(1)), mapper: list(stat('$mapValue')) },
          sort_by_selector: stat('$sortByValue') } },
        constant('|'), { type: 'findFirst', components: list(constant(0), constant(2)),
          filter: { type: 'greaterThan', components: list(stat('$findFirstValue'), constant(0)) } },
        constant('|'), yesNo({ type: 'contains', haystack: { type: 'toLowerCase', components: stat('appunti') }, needle: constant('fighter') }),
        constant('|'), yesNo({ type: 'isNull', components: { type: 'findFirst', components: list() } })
      )
    } }
  }] };
  await page.goto('./');
  await importJson(page, JSON.stringify(source));
  await create(page, 'Mira');
  await expect(page.getByText('1,3|2|no|si', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Appunti di viaggio', exact: true }).fill('FIGHTER');
  await page.getByRole('textbox', { name: 'Appunti di viaggio', exact: true }).press('Tab');
  await expect(page.getByText('1,3|2|si|si', { exact: true })).toBeVisible();
  await waitForWorker(page);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: /Mira/ }).click();
  await expect(page.getByText('1,3|2|si|si', { exact: true })).toBeVisible();
});

test('omitted sortBy order imports without a notice and sorts ascending', async ({ page, context }) => {
  const sorted = {
    id: 'default-sort', view: { id: 'sorted-result', type: 'text', text: {
      type: 'joinToString', separator: ',', components: { type: 'sortBy',
        components: list(stat('vigore'), constant(10), constant(1)), sort_by_selector: stat('$sortByValue') }
    } }
  };
  const source = { ...demo,
    ...Object.fromEntries(Array.from({ length: 110 }, (_, i) => [`future_field_${i}`, true])),
    character_sheet_sections: [...demo.character_sheet_sections, sorted]
  };
  const original = '\ufeff' + JSON.stringify(source);
  await page.goto('./');
  await importJson(page, original, false);
  const preview = page.getByRole('dialog', { name: 'Prima di importare' });
  await expect(preview).not.toContainText('sortBy');
  await expect(preview.getByText('Supporto parziale', { exact: true })).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Conferma importazione' })).toBeEnabled();
  await preview.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(page.locator('.system-card')).toHaveCount(0);
  const invalid = structuredClone(sorted);
  Object.assign(invalid.view.text.components, { order: null });
  await importJson(page, JSON.stringify({ ...source, character_sheet_sections: [...demo.character_sheet_sections, invalid] }), false);
  await expect(preview.getByRole('button', { name: 'Conferma importazione' })).toBeDisabled();
  await preview.getByRole('button', { name: 'Annulla', exact: true }).click();
  await importJson(page, original);
  await navigate(page, 'Compatibilità');
  await expect(page.locator('main')).not.toContainText('sortBy');
  await create(page, 'Ordine compatibile');
  await expect(page.getByText('1,2,10', { exact: true })).toBeVisible();
  await page.getByLabel('Modifica Vigore', { exact: true }).fill('12');
  await page.getByLabel('Modifica Vigore', { exact: true }).press('Tab');
  await expect(page.getByText('1,10,12', { exact: true })).toBeVisible();
  await waitForWorker(page);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: /Ordine compatibile/ }).click();
  await expect(page.getByText('1,10,12', { exact: true })).toBeVisible();
  await navigate(page, 'Impostazioni');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta backup', exact: true }).click();
  const backup = readFileSync((await (await download).path())!, 'utf8');
  expect(JSON.parse(backup).systems[0].original).toBe(original);
  await page.locator('input[type=file]').setInputFiles({ name: 'sort-order-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByRole('button', { name: 'Sostituisci archivio', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: /Ordine compatibile/ }).click();
  await expect(page.getByText('1,10,12', { exact: true })).toBeVisible();
});

for (const id of ['5e', '5e2024', 'pf2e']) {
  test(`official ${id} imports unchanged without a sortBy order notice`, async ({ page, context }, testInfo) => {
    const file = resolve(`.reference/official-releases-2026-11-16/${id}-system.rpg`);
    test.skip(!existsSync(file), 'Prepare the local-only official release package.');
    const bytes = readFileSync(file);
    await page.goto('./');
    await navigate(page, copy.systems);
    await page.locator('input[type=file]').setInputFiles(file);
    const preview = page.getByRole('dialog', { name: 'Prima di importare' });
    await expect(preview.getByText('Supporto parziale', { exact: true })).toBeVisible();
    await expect(preview).not.toContainText('sortBy');
    await expect(preview.getByRole('button', { name: 'Conferma importazione' })).toBeEnabled();
    if (id === '5e') await page.screenshot({ path: testInfo.outputPath('official-5e-import-warning.png'), fullPage: true });
    await preview.getByRole('button', { name: 'Conferma importazione' }).click();
    await expect(preview).not.toBeVisible();
    await expect(page.locator('.system-card')).toHaveCount(1);
    await page.locator('.system-card .card-footer .link-button').click();
    await expect(page.locator('main')).not.toContainText('sortBy senza order');
    await waitForWorker(page);
    await context.setOffline(true);
    await page.reload();
    await navigate(page, copy.systems);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Esporta .rpg originale', exact: true }).click();
    expect(readFileSync((await (await download).path())!)).toEqual(bytes);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('source popup drafts and validated local resources survive cancel, offline and backup', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./'); await importJson(page, JSON.stringify(viewSystem)); await create(page, 'Mira dei fogli');
  await page.getByRole('button', { name: 'Gestisci stato', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Pronto per partire' }).click();
  await page.getByRole('dialog').getByLabel('Modifica Scorte', { exact: true }).fill('9');
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(page.getByText('Pronto', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Gestisci stato', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Pronto per partire' })).not.toBeChecked();
  await expect(page.getByRole('dialog').getByLabel('Modifica Scorte', { exact: true })).toHaveValue('6');
  await page.getByRole('checkbox', { name: 'Pronto per partire' }).click();
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('Pronto', { exact: true })).toBeVisible();
  await expect(page.getByText('Non supportato: on_tap_event').first()).toBeVisible();
  for (const title of ['Prima nota', 'Seconda nota']) {
    await page.getByRole('button', { name: 'Aggiungi risorsa · Nota locale', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Scrivi un titolo');
    await expect(page.getByRole('button', { name: 'Salva', exact: true })).toBeDisabled();
    await page.getByLabel('Titolo locale', { exact: true }).fill(title);
    await page.getByLabel('Testo locale', { exact: true }).fill('Un sentiero nel bosco');
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('button', { name: `Dettagli · ${title}`, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Sposta su · Seconda nota', exact: true }).click();
  await expect(page.locator('.source-resource-item').first()).toContainText('Seconda nota');
  await page.getByRole('button', { name: 'Dettagli · Prima nota', exact: true }).click();
  await page.getByRole('button', { name: 'Modifica', exact: true }).click();
  await page.getByLabel('Testo locale', { exact: true }).fill('Da annullare');
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Dettagli · Prima nota', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Un sentiero nel bosco');
  await page.getByRole('dialog').getByRole('button', { name: 'Chiudi', exact: true }).click();
  await page.getByRole('button', { name: 'Scollega · Prima nota', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dettagli · Prima nota', exact: true })).not.toBeVisible();
  await waitForWorker(page); await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: /Mira dei fogli/ }).click();
  await expect(page.getByText('Pronto', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dettagli · Seconda nota', exact: true })).toBeVisible();
  await navigate(page, 'Impostazioni');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta backup', exact: true }).click();
  const backup = readFileSync((await (await event).path())!, 'utf8');
  const data = JSON.parse(backup);
  expect(data.resources).toHaveLength(2);
  expect(data.characters[0].values.notes).toHaveLength(1);
  expect(data.characters[0].values.ready).toBe(true);
  expect(data.systems[0].original).toBe(JSON.stringify(viewSystem));
  await page.locator('input[type=file]').setInputFiles({ name: 'views.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByRole('button', { name: 'Sostituisci archivio', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: /Mira dei fogli/ }).click();
  await expect(page.getByText('Pronto', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dettagli · Seconda nota', exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});

test('local import → character → edits → offline reload → complete backup round-trip', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await importJson(page, '\ufeff' + demoOriginal);
  await create(page, 'Ada del passo');
  await expect(page.getByTestId('stat-slancio')).toHaveText('3');
  await page.getByLabel('Modifica Vigore', { exact: true }).fill('7');
  await page.getByLabel('Modifica Vigore', { exact: true }).press('Tab');
  await expect(page.getByTestId('stat-slancio')).toHaveText('8');
  await page.getByRole('textbox', { name: 'Appunti di viaggio', exact: true }).fill('Il ponte a nord è sicuro.');
  await page.getByRole('textbox', { name: 'Appunti di viaggio', exact: true }).press('Tab');
  await waitForWorker(page);
  await context.setOffline(true);
  await page.reload();
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await page.getByRole('button', { name: /Ada del passo/ }).click();
  await expect(page.getByTestId('stat-slancio')).toHaveText('8');
  await expect(page.getByRole('textbox', { name: 'Appunti di viaggio', exact: true })).toHaveValue('Il ponte a nord è sicuro.');
  await navigate(page, 'Risorse');
  await page.getByRole('button', { name: 'Nuova risorsa locale', exact: true }).click();
  await page.getByLabel('Nome nell’archivio').fill('Mappa del passo');
  await page.getByLabel('Titolo', { exact: true }).fill('Il passo a nord');
  await page.getByLabel('Descrizione', { exact: true }).fill('Sentiero segnato sul ponte.');
  await page.getByRole('button', { name: 'Salva risorsa' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Collega', exact: true }).click();
  await navigate(page, 'Dadi');
  await page.getByLabel('Formula del tiro').fill('2d6 + 3');
  await page.getByRole('button', { name: 'Lancia i dadi', exact: true }).click();
  await expect(page.locator('.dice-result output')).toHaveText(/^\d+$/);
  await navigate(page, 'Impostazioni');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta backup' }).click();
  const download = await downloadEvent;
  const backup = readFileSync((await download.path())!, 'utf8');
  const data = JSON.parse(backup);
  expect(data.characters[0].values.vigore).toBe(7);
  expect(data.characters[0].resourceIds).toHaveLength(1);
  expect(data.resources).toHaveLength(1); expect(data.rolls).toHaveLength(1);
  await navigate(page, 'Personaggi');
  await page.getByRole('button', { name: /Ada del passo/ }).click();
  await page.getByRole('button', { name: 'Elimina', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Elimina', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'La prossima storia inizia qui.' })).toBeVisible();
  await navigate(page, 'Impostazioni');
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Sostituisci archivio' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: /Ada del passo/ }).click();
  await expect(page.getByTestId('stat-slancio')).toHaveText('8');
  await expect(page.getByText('Mappa del passo', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Appunti di viaggio', exact: true })).toHaveValue('Il ponte a nord è sicuro.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('typed photos, lists, resource references and encounter turns survive offline backup restore', async ({ page, context }) => {
  await page.goto('./'); await importJson(page, JSON.stringify(capabilitySystem));
  await create(page, 'Mara');
  await page.locator('.base-editor > summary').click();
  await page.getByRole('button', { name: 'Aggiungi valore', exact: true }).click();
  await page.getByLabel('words 1', { exact: true }).fill('Nord');
  await page.getByLabel('words 1', { exact: true }).press('Tab');
  await page.getByLabel('Scegli foto · portrait', { exact: true }).setInputFiles({
    name: 'truncated.png', mimeType: 'image/png', buffer: readFileSync(resolve('public/icon-192.png')).subarray(0, 33)
  });
  await expect(page.getByRole('alert')).toHaveText('Foto PNG/JPEG non decodificabile.');
  await page.getByLabel('Scegli foto · portrait', { exact: true }).setInputFiles(resolve('public/icon-192.png'));
  await expect(page.getByRole('img', { name: 'portrait', exact: true })).toHaveAttribute('src', /^data:image\/png;base64,/);
  await navigate(page, 'Risorse');
  await page.getByRole('button', { name: 'Nuova risorsa locale', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo di risorsa', exact: true }).selectOption('scout');
  await page.getByLabel('Nome nell’archivio', { exact: true }).fill('Guardia Nord');
  await page.getByRole('button', { name: 'Salva risorsa', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, 'Personaggi');
  await page.getByRole('button', { name: /Mara/ }).click();
  await page.locator('.base-editor > summary').click();
  await page.getByRole('combobox', { name: 'origin', exact: true }).selectOption({ label: 'Guardia Nord · scout' });
  await page.getByRole('checkbox', { name: 'Guardia Nord · scout', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Guardia Nord · scout', exact: true })).toBeChecked();
  await navigate(page, 'Combattimento');
  await page.getByLabel('Nome dell’incontro', { exact: true }).fill('Guado');
  await page.getByRole('button', { name: 'Nuovo incontro', exact: true }).click();
  await page.getByRole('button', { name: 'Aggiungi combattente', exact: true }).click();
  await expect(page.locator('.combatant-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Aggiungi combattente', exact: true }).click();
  await expect(page.locator('.combatant-card')).toHaveCount(2);
  await page.getByLabel('Iniziativa · Sentinella', { exact: true }).nth(0).fill('15');
  await page.getByLabel('Iniziativa · Sentinella', { exact: true }).nth(0).press('Tab');
  await page.getByLabel('Iniziativa · Sentinella', { exact: true }).nth(1).fill('10');
  await page.getByLabel('Iniziativa · Sentinella', { exact: true }).nth(1).press('Tab');
  await page.getByRole('button', { name: 'Avvia / riprendi', exact: true }).click();
  await expect(page.locator('.combatant-current')).toHaveCount(1);
  await page.getByRole('button', { name: 'Prossimo turno', exact: true }).click();
  await page.getByRole('button', { name: 'Prossimo turno', exact: true }).click();
  await expect(page.getByText(/Round 2 · Passaggio 1/)).toBeVisible();
  await waitForWorker(page); await context.setOffline(true); await page.reload();
  await navigate(page, 'Combattimento');
  await expect(page.getByText(/Round 2 · Passaggio 1/)).toBeVisible();
  await navigate(page, 'Impostazioni');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta backup', exact: true }).click();
  const bytes = readFileSync((await (await event).path())!);
  const backup = JSON.parse(bytes.toString('utf8'));
  expect(backup.version).toBe(4); expect(backup.combats[0].round).toBe(2);
  expect(backup.characters[0].values.words).toEqual(['Nord']);
  expect(backup.characters[0].values.companions).toEqual([backup.characters[0].values.origin]);
  expect(backup.characters[0].values.portrait.base64).toBeTruthy();
  await page.locator('input[type=file]').setInputFiles({ name: 'encounter-backup.json', mimeType: 'application/json', buffer: bytes });
  await page.getByRole('button', { name: 'Sostituisci archivio', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, 'Combattimento');
  await expect(page.getByText(/Round 2 · Passaggio 1/)).toBeVisible();
});

test('rejects malformed files and shows unknown components without running scripts', async ({ page }) => {
  await page.goto('./'); await navigate(page, copy.systems);
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await expect(page.getByRole('alert')).toContainText('JSON malformato');
  await importJson(page, JSON.stringify({ ...demo, character_sheet_sections: [
    ...demo.character_sheet_sections,
    { id: 'unknown', view: { id: 'unknown_view', type: 'futureWidget', code: 'window.compromised=true' } }
  ] }));
  await create(page, 'Test sicuro');
  await expect(page.getByText('Non supportato: futureWidget', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Object.hasOwn(window, 'compromised'))).toBe(false);
});

test('URL imports report HTTP and CORS errors and import a permitted JSON response', async ({ page }) => {
  await page.goto('./'); await navigate(page, copy.systems);
  await page.route('https://fixtures.polysheet.test/missing.json', route => route.fulfill({ status: 404, body: 'Not found', headers: { 'access-control-allow-origin': '*' } }));
  await page.getByRole('button', { name: copy.importUrl }).click();
  await page.getByLabel('URL del sistema o repository GitHub').fill('https://fixtures.polysheet.test/missing.json');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 404');
  await page.route('https://fixtures.polysheet.test/cors.json', route => route.abort('failed'));
  await page.getByLabel('URL del sistema o repository GitHub').fill('https://fixtures.polysheet.test/cors.json');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('alert')).toContainText('CORS');
  await page.route('https://fixtures.polysheet.test/system.json', route => route.fulfill({ status: 200, body: demoOriginal, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }));
  await page.getByLabel('URL del sistema o repository GitHub').fill('https://fixtures.polysheet.test/system.json');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('dialog', { name: 'Prima di importare' })).toBeVisible();
  await page.getByRole('button', { name: 'Conferma importazione' }).click();
  await expect(page.getByRole('heading', { name: 'Sentieri', exact: true })).toBeVisible();
});

for (const id of ['5e', '5e2024', 'pf2e']) {
  test(`repository link imports ${id} and catalog originals with preview, private assignment and offline restore`, async ({ page, context }) => {
    const commit = '1'.repeat(40), treeSha = '2'.repeat(40);
    const files = new Map<string, string>();
    for (const systemId of ['5e', '5e2024', 'pf2e']) {
      files.set(`systems/${systemId}/system/system.rpg.json`, JSON.stringify({ id: systemId, name: systemId === '5e2024' ? '5.5e' : systemId, version: '1.0.0' }));
      files.set(`systems/${systemId}/resource_instances/class_original.rpg.json`, classOriginal.replace('catalog-original', systemId));
      files.set(`systems/${systemId}/resource_instances/race_original.rpg.json`, raceOriginal);
      const bad = JSON.parse(classOriginal.slice(1)); bad.system = systemId; bad.stats.name.value = 'Non assegnabile';
      bad.stats.features.value[0].stats.amount.value = 'not an integer';
      files.set(`systems/${systemId}/resource_instances/class_invalid.rpg.json`, JSON.stringify(bad));
    }
    const headers = { 'access-control-allow-origin': '*' };
    await page.route('https://api.github.com/repos/blastervla/rpg-companion-app-systems/**', route => route.fulfill({
      headers, json: route.request().url().includes('/commits?')
        ? [{ sha: commit, commit: { tree: { sha: treeSha } } }]
        : { sha: treeSha, truncated: false, tree: [...files].map(([path, text]) => ({ path, size: Buffer.byteLength(text), type: 'blob', mode: '100644' })) }
    }));
    let reads = 0;
    await page.route('https://raw.githubusercontent.com/blastervla/rpg-companion-app-systems/**', route => {
      reads++;
      expect(route.request().url()).toContain('/' + commit + '/');
      const path = route.request().url().split('/' + commit + '/')[1];
      const body = files.get(path);
      if (body === undefined) return route.fulfill({ status: 404, headers, body: 'Unexpected source' });
      return route.fulfill({ headers, contentType: 'application/json', body });
    });
    await page.goto('./'); await navigate(page, copy.systems);
    async function preview() {
      await page.getByRole('button', { name: copy.importUrl, exact: true }).click();
      await page.getByLabel('URL del sistema o repository GitHub').fill('https://github.com/blastervla/rpg-companion-app-systems');
      await page.getByRole('button', { name: 'Carica anteprima', exact: true }).click();
      const options = page.getByRole('combobox', { name: 'Sistema disponibile', exact: true });
      await expect(options.locator('option')).toHaveText(['5e · v1.0.0', '5.5e · v1.0.0', 'pf2e · v1.0.0']);
      await options.selectOption(id);
      await expect(page.getByRole('button', { name: 'Carica sistema e cataloghi', exact: true })).toBeEnabled();
      await page.getByLabel('Sistema compilato da file', { exact: true }).setInputFiles({
        name: 'system.rpg', mimeType: 'application/gzip', buffer: gzipSync(JSON.stringify({ ...catalogSystem, id }))
      });      await page.getByRole('button', { name: 'Carica sistema e cataloghi', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Prima di importare', exact: true });
      await expect(dialog).toContainText('Modelli di catalogo: 3 · Modelli non assegnabili: 1');
      await dialog.locator('summary').filter({ hasText: copy.repositoryCatalogs }).click();
      await expect(dialog).toContainText('Originale conservato, non assegnabile');
      await expect(page.locator('.system-card')).toHaveCount(0);
    }
    await preview();
    expect(reads).toBe(6);
    await page.getByRole('button', { name: 'Annulla', exact: true }).click();
    await expect(page.locator('.system-card')).toHaveCount(0);
    await preview();
    await page.getByRole('button', { name: 'Conferma importazione', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await create(page, 'Cataloghi automatici');
    const aside = page.locator('.sheet-aside');
    await expect(aside.getByRole('combobox', { name: 'Classe da aggiungere', exact: true }).locator('option')).toHaveText(['Viandante']);
    await aside.getByRole('combobox', { name: 'race', exact: true }).selectOption({ label: 'Collina' });
    await aside.getByRole('button', { name: 'Aggiungi classe', exact: true }).click();
    const level = aside.getByRole('spinbutton', { name: 'Livello manuale · Viandante', exact: true });
    await expect(level).toHaveValue('1'); await level.fill('2'); await level.press('Tab'); await expect(level).toHaveValue('2');
    await waitForWorker(page); await context.setOffline(true); await page.reload();
    await page.getByRole('button', { name: /Cataloghi automatici/ }).click();
    await expect(level).toHaveValue('2');
    await navigate(page, 'Impostazioni');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Esporta backup', exact: true }).click();
    const backup = readFileSync((await (await download).path())!, 'utf8'), data = JSON.parse(backup);
    expect(data.resources.filter((r: { catalogSource?: unknown }) => r.catalogSource)).toHaveLength(3);
    expect(data.resources.find((r: { catalogSource?: { original: string } }) => r.catalogSource?.original.startsWith('\ufeff'))).toBeTruthy();
    expect(data.characters[0].values.classes).toHaveLength(1);
    await page.locator('input[type=file]').setInputFiles({ name: 'catalog-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await page.getByRole('button', { name: 'Sostituisci archivio', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: /Cataloghi automatici/ }).click();
    await expect(level).toHaveValue('2');
    await context.setOffline(false);
    await navigate(page, copy.systems);
    await page.getByRole('button', { name: copy.importUrl, exact: true }).click();
    await page.getByLabel('URL del sistema o repository GitHub').fill('https://github.com/blastervla/rpg-companion-app-systems');
    await page.getByRole('button', { name: 'Carica anteprima', exact: true }).click();
    await page.getByRole('combobox', { name: 'Sistema disponibile', exact: true }).selectOption(id);
    await expect(page.getByRole('combobox', { name: 'Sistema locale da riutilizzare', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Sistema locale da riutilizzare', exact: true }).selectOption({ index: 1 });
    await expect(page.getByRole('button', { name: 'Carica sistema e cataloghi', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Carica sistema e cataloghi', exact: true }).click();
    await page.getByRole('button', { name: 'Conferma importazione', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await navigate(page, 'Impostazioni');
    const repeat = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Esporta backup', exact: true }).click();
    const repeated = JSON.parse(readFileSync((await (await repeat).path())!, 'utf8'));
    expect(repeated.systems).toHaveLength(1);
    expect(repeated.resources.filter((r: { catalogSource?: unknown }) => r.catalogSource)).toHaveLength(3);
  });
}
test('GitHub clone URL discovers files, validates selection and retains an immutable offline import', async ({ page, context }) => {
  const repository = 'https://github.com/derpsyhome/3rd-party-books-for-5e';
  const commit = '1'.repeat(40), treeSha = '2'.repeat(40);
  const bytes = gzipSync(demoOriginal), bad = '{"resources":[]}';
  let htmlRequests = 0, rawRequests = 0, apiRequests = 0;
  const headers = { 'access-control-allow-origin': '*' };
  await page.route(repository + '**', async route => { htmlRequests++; await route.abort('failed'); });
  await page.route('https://api.github.com/repos/derpsyhome/3rd-party-books-for-5e/**', async route => {
    apiRequests++;
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/commits')) {
      expect(url.searchParams.get('sha')).toBe('release/test');
      await route.fulfill({ headers, json: [{ sha: commit, commit: { tree: { sha: treeSha } } }] });
    } else if (url.pathname.endsWith('/git/trees/' + treeSha)) {
      expect(url.searchParams.get('recursive')).toBe('1');
      await route.fulfill({ headers, json: { sha: treeSha, truncated: false, tree: [
        { path: '5e/system.rpg', type: 'blob', mode: '100644', size: bytes.length },
        { path: 'a/system.json', type: 'blob', mode: '100644', size: Buffer.byteLength(bad) },
        { path: 'resources.rpg', type: 'blob', mode: '100644', size: 20 }
      ] } });
    } else await route.fulfill({ status: 501, body: 'Unexpected API request' });
  });
  await page.route('https://raw.githubusercontent.com/derpsyhome/3rd-party-books-for-5e/**', async route => {
    rawRequests++;
    expect(route.request().url()).toContain('/' + commit + '/');
    await route.fulfill({ headers, body: route.request().url().endsWith('system.json') ? bad : bytes, contentType: 'application/octet-stream' });
  });
  await page.goto('./'); await navigate(page, copy.systems);
  await page.getByRole('button', { name: copy.importUrl }).click();
  await page.getByLabel('URL del sistema o repository GitHub').fill(repository + '.git');
  await page.getByText(copy.importAdvanced, { exact: true }).click();
  await page.getByRole('textbox', { name: copy.repositoryRef, exact: true }).fill('release/test');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByLabel('File di sistema nel repository')).toBeVisible();
  expect(rawRequests).toBe(0); expect(htmlRequests).toBe(0); expect(apiRequests).toBe(2);
  await expect(page.getByLabel('File di sistema nel repository').locator('option')).toHaveCount(2);
  await page.getByLabel('File di sistema nel repository').selectOption('a/system.json');
  await page.getByRole('button', { name: 'Carica file selezionato' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Prima di importare' })).not.toBeVisible();
  await expect(page.locator('.system-card')).toHaveCount(0);
  await page.getByLabel('File di sistema nel repository').selectOption('5e/system.rpg');
  await page.getByRole('button', { name: 'Carica file selezionato' }).click();
  await expect(page.getByRole('dialog', { name: 'Prima di importare' })).toContainText(`/${commit}/5e/system.rpg`);
  await expect(page.locator('.system-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(page.locator('.system-card')).toHaveCount(0);
  await page.getByRole('button', { name: copy.importUrl }).click();
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await page.getByRole('button', { name: 'Carica file selezionato' }).click();
  await page.getByRole('button', { name: 'Conferma importazione' }).click();
  await expect(page.getByRole('heading', { name: 'Sentieri', exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta .rpg originale' }).click();
  const download = await downloadPromise, path = await download.path();
  if (!path) throw new Error('Missing original export');
  expect(readFileSync(path)).toEqual(bytes);
  await waitForWorker(page);
  await context.setOffline(true); await page.reload(); await navigate(page, copy.systems);
  await expect(page.getByRole('heading', { name: 'Sentieri', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('GitHub discovery reports rate limits, missing repositories and authoring-only trees', async ({ page }) => {
  let status = 429;
  const commit = '1'.repeat(40), treeSha = '2'.repeat(40);
  await page.route('https://api.github.com/repos/owner/repo/**', route => {
    if (status !== 200) return route.fulfill({ status, body: '{}', headers: { 'access-control-allow-origin': '*' } });
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: route.request().url().includes('/commits?')
      ? [{ sha: commit, commit: { tree: { sha: treeSha } } }]
      : { sha: treeSha, truncated: false, tree: [{ path: 'stats.rpgs', type: 'blob', mode: '100644', size: 2 }] } });
  });
  await page.goto('./'); await navigate(page, copy.systems);
  await page.getByRole('button', { name: copy.importUrl }).click();
  await page.getByLabel('URL del sistema o repository GitHub').fill('git@github.com:owner/repo.git');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('alert')).toContainText('Limite di richieste GitHub');
  status = 404;
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('alert')).toContainText('non trovato o non pubblico');
  status = 200;
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('alert')).toContainText('Nessun system.rpg');
  await expect(page.locator('.system-card')).toHaveCount(0);
});

if (process.env.LIVE_GITHUB_IMPORT === '1') test('live public GitHub repository resolves the pinned original system', async ({ page }) => {
  await page.goto('./'); await navigate(page, copy.systems);
  await page.getByRole('button', { name: copy.importUrl }).click();
  await page.getByLabel('URL del sistema o repository GitHub').fill('https://github.com/derpsyhome/3rd-party-books-for-5e.git');
  await page.getByText(copy.importAdvanced, { exact: true }).click();
  await page.getByRole('textbox', { name: copy.repositoryRef, exact: true }).fill('00f55b2c3023c59f5857297dc933a7505c9b6aa4');
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await page.getByLabel('File di sistema nel repository').selectOption('5e/system.rpg');
  await page.getByRole('button', { name: 'Carica file selezionato' }).click();
  const preview = page.getByRole('dialog', { name: 'Prima di importare' });
  await expect(preview).toContainText('v0.6.0');
  await expect(preview).toContainText('317 statistiche');
  await expect(preview).toContainText('00f55b2c3023c59f5857297dc933a7505c9b6aa4/5e/system.rpg');
});

test('theme, keyboard focus, mobile layout and multiple characters', async ({ page }, testInfo) => {
  await page.goto('./'); await importJson(page, demoOriginal);
  for (const name of ['Mira di Rocca', 'Lupo delle Felci', 'Neri']) await create(page, name);
  await navigate(page, 'Impostazioni');
  await page.getByRole('button', { name: 'Scuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await navigate(page, 'Impostazioni');
  await page.getByRole('button', { name: 'Chiaro', exact: true }).click();
  await navigate(page, 'Personaggi');
  await expect(page.locator('.character-card')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
  await page.screenshot({ path: testInfo.outputPath('characters.png'), fullPage: true });
});

test('pinned real external subset survives browser editing and offline reopening', async ({ page, context }) => {
  test.skip(!existsSync(resolve('.reference/5e-slice.json')), 'Run npm run test:external to prepare the licensed local-only subset.');
  await page.goto('./');
  await importJson(page, readFileSync(resolve('.reference/5e-slice.json'), 'utf8'));
  await create(page, 'External integration');
  await expect(page.getByTestId('stat-strength_modifier')).toHaveText('-1');
  await page.getByLabel('Modifica Strength', { exact: true }).fill('15');
  await page.getByLabel('Modifica Strength', { exact: true }).press('Tab');
  await expect(page.getByTestId('stat-strength_modifier')).toHaveText('2');
  await expect(page.getByText('Non supportato: on_tap_event').first()).toBeVisible();
  await waitForWorker(page); await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: /External integration/ }).click();
  await expect(page.getByTestId('stat-strength_modifier')).toHaveText('2');
});

test('provided Archer compiled system JSON imports with explicit partial support', async ({ page, context }) => {
  const path = resolve('.reference/archer-system.json');
  test.skip(!existsSync(path), 'Run node scripts/inspect-archer.mjs after cloning the provided repo.');
  await page.goto('./');
  await importJson(page, readFileSync(path, 'utf8'), false);
  await expect(page.getByRole('dialog').getByText('Supporto parziale', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Conferma importazione' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await create(page, 'Provided repository');
  const abilities = page.locator('.sheet-section').filter({ hasText: 'Ability Modifiers' });
  await expect(abilities.getByTestId('stat-strength_modifier')).toHaveText('-1');
  await abilities.getByLabel('Modifica Strength', { exact: true }).fill('15');
  await abilities.getByLabel('Modifica Strength', { exact: true }).press('Tab');
  await expect(abilities.getByTestId('stat-strength_modifier')).toHaveText('2');
  await waitForWorker(page); await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: /Provided repository/ }).click();
  await expect(abilities.getByTestId('stat-strength_modifier')).toHaveText('2');
});

for (const { label, file, stat, input, before, after, value } of [
  { label: 'Sentieri', file: '', stat: 'slancio', input: 'Vigore', before: '3', after: '8', value: '7' },
  { label: 'Archer', file: '.reference/archer-system.rpg', stat: 'strength_modifier', input: 'Strength', before: '-1', after: '2', value: '15' },
  { label: 'derpsy', file: '.reference/derpsy-system.rpg', stat: 'strength_modifier', input: 'Strength', before: '-1', after: '2', value: '15' }
]) {
  test(`original ${label} .rpg survives file import, offline, exact export and backup restore`, async ({ page, context }) => {
    test.skip(Boolean(file) && !existsSync(resolve(file)), 'Prepare the local-only pinned source artifact.');
    const original = file ? readFileSync(resolve(file)) : gzipSync(demoOriginal);
    await page.goto('./'); await navigate(page, copy.systems);
    await page.locator('input[type=file]').setInputFiles({ name: 'system.rpg', mimeType: 'application/gzip', buffer: original });
    if (file) await expect(page.getByRole('dialog').getByText('Supporto parziale', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Conferma importazione' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await create(page, 'Original package');
    const sheet = file ? page.locator('.sheet-section').filter({ hasText: 'Ability Modifiers' }) : page.locator('main');
    await expect(sheet.getByTestId(`stat-${stat}`)).toHaveText(before);
    await sheet.getByLabel(`Modifica ${input}`, { exact: true }).fill(value);
    await sheet.getByLabel(`Modifica ${input}`, { exact: true }).press('Tab');
    await expect(sheet.getByTestId(`stat-${stat}`)).toHaveText(after);
    if (file) {
      await page.getByRole('button', { name: 'Manage conditions', exact: true }).click();
      await page.getByRole('dialog').getByRole('checkbox', { name: 'Blinded', exact: true }).click();
      await page.getByRole('button', { name: 'Annulla', exact: true }).click();
      await page.getByRole('button', { name: 'Manage conditions', exact: true }).click();
      await expect(page.getByRole('dialog').getByRole('checkbox', { name: 'Blinded', exact: true })).not.toBeChecked();
      await page.getByRole('dialog').getByRole('checkbox', { name: 'Blinded', exact: true }).click();
      await page.getByRole('button', { name: 'Salva', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByText('Blinded', { exact: true }).first()).toBeVisible();
      await page.getByText('Campi delle pagine sorgente · modifica manuale', { exact: true }).click();
      await page.getByRole('button', { name: 'Modifica · edit_character_basics_ability_scores_point_buy_composite', exact: true }).click();
      await page.getByRole('dialog').getByLabel('Modifica Strength', { exact: true }).fill('14');
      await expect(page.getByRole('dialog').locator('.stat-block').filter({ hasText: 'point' }).first()).toBeVisible();
      const save = page.getByRole('button', { name: 'Salva', exact: true });
      const footer = await save.boundingBox();
      await page.getByRole('dialog').locator('.source-form-fields').evaluate(element => { element.scrollTop = 0; });
      await save.click({ trial: true });
      expect((await save.boundingBox())!.y).toBe(footer!.y);
      expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.getByRole('button', { name: 'Salva', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await page.getByRole('button', { name: 'Aggiungi risorsa · Note', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Salva', exact: true })).toBeDisabled();
      await page.getByLabel('Note title', { exact: true }).fill('Original local note');
      await page.getByLabel('Note', { exact: true }).fill('Local-only regression text');
      await page.getByRole('button', { name: 'Salva', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Dettagli · Original local note', exact: true })).toBeVisible();
    }
    await waitForWorker(page); await context.setOffline(true); await page.reload();
    await page.getByRole('button', { name: /Original package/ }).click();
    await expect(sheet.getByTestId(`stat-${stat}`)).toHaveText(after);
    await navigate(page, copy.systems);
    let event = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Esporta .rpg originale', exact: true }).click();
    let exported = await event;
    expect(exported.suggestedFilename()).toMatch(/\.rpg$/);
    expect(readFileSync((await exported.path())!)).toEqual(original);
    await navigate(page, 'Impostazioni');
    event = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Esporta backup', exact: true }).click();
    const backup = readFileSync((await (await event).path())!, 'utf8');
    const parsed = JSON.parse(backup);
    if (file) {
      expect(parsed.characters[0].values.blinded).toBe(true);
      expect(parsed.characters[0].values.strength_score).toBe(14);
      expect(parsed.characters[0].values.notes).toHaveLength(1);
    }
    expect(parsed.version).toBe(4);
    expect(Buffer.from(parsed.systems[0].artifact.base64, 'base64')).toEqual(original);
    await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Sostituisci archivio' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: /Original package/ }).click();
    await expect(sheet.getByTestId(`stat-${stat}`)).toHaveText(after);
    await navigate(page, copy.systems);
    event = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Esporta .rpg originale', exact: true }).click();
    exported = await event;
    expect(readFileSync((await exported.path())!)).toEqual(original);
  });
}

test('direct raw .rpg imports the supplied repository system', async ({ page }) => {
  const path = resolve('.reference/derpsy-system.rpg');
  test.skip(!existsSync(path), 'Prepare the pinned derpsy system artifact.');
  const url = 'https://raw.githubusercontent.com/derpsyhome/3rd-party-books-for-5e/00f55b2c3023c59f5857297dc933a7505c9b6aa4/5e/system.rpg';
  const bytes = readFileSync(path);
  if (process.env.LIVE_RPG_IMPORT !== '1') {
    await page.route(url, route => route.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } }));
  }
  await page.goto('./'); await navigate(page, copy.systems);
  await page.getByRole('button', { name: copy.importUrl }).click();
  await page.getByLabel('URL del sistema o repository GitHub').fill(url);
  await page.getByRole('button', { name: 'Carica anteprima' }).click();
  await expect(page.getByRole('dialog', { name: 'Prima di importare' })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Supporto parziale', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Conferma importazione' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta .rpg originale', exact: true }).click();
  expect(readFileSync((await (await event).path())!)).toEqual(bytes);
});

test('bad .rpg envelopes and gzip resource indexes fail without installation', async ({ page }) => {
  await page.goto('./'); await navigate(page, copy.systems);
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.rpg', mimeType: 'application/octet-stream', buffer: Buffer.from([80, 75, 3, 4]) });
  await expect(page.getByRole('alert')).toContainText('Formato .rpg non riconosciuto');
  await page.locator('input[type=file]').setInputFiles({ name: 'systems.rpg', mimeType: 'application/gzip', buffer: gzipSync('{"systems":[]}') });
  await expect(page.getByRole('alert')).toContainText('non contiene un sistema JSON monolitico');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.system-card')).toHaveCount(0);
});

test('.rpg expanded byte ceiling rejects 8 MiB plus one and accepts exactly 8 MiB', async ({ page }) => {
  const limit = 8 * 1024 * 1024;
  const boundary = demoOriginal + ' '.repeat(limit - Buffer.byteLength(demoOriginal));
  await page.goto('./'); await navigate(page, copy.systems);
  await page.locator('input[type=file]').setInputFiles({ name: 'bomb.rpg', mimeType: 'application/gzip', buffer: gzipSync(boundary + ' ') });
  await expect(page.getByRole('alert')).toContainText('troppo grande');
  await expect(page.locator('.system-card')).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({ name: 'boundary.rpg', mimeType: 'application/gzip', buffer: gzipSync(boundary) });
  await expect(page.getByRole('dialog', { name: 'Prima di importare' })).toBeVisible();
  await page.getByRole('button', { name: 'Conferma importazione' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.system-card')).toHaveCount(1);
});

for (const [id, expected, blocked] of [['5e', 208, 0], ['5e2024', 74, 19], ['pf2e', 141, 0]] as const) {
  test(`real repository ${id} imports every original catalog and survives offline backup`, async ({ page, context }) => {
    test.setTimeout(120000);
    const root = resolve('.reference/rpg-companion-app-systems/systems');
    const releases = resolve('.reference/official-releases-2026-11-16');
    test.skip(!existsSync(root) || !existsSync(resolve(releases, `${id}-system.rpg`)), 'Licensed pinned source repository and official release are local-only');
    const commit = '8788e3b18099e4a1b3510f02869d97f1488586b4', treeSha = '2'.repeat(40);
    const files = new Map<string, Buffer>();
    for (const key of ['5e', '5e2024', 'pf2e'])
      files.set(`systems/${key}/system/system.rpg.json`, readFileSync(resolve(root, key, 'system/system.rpg.json')));
    const directory = resolve(root, id, 'resource_instances');
    for (const name of readdirSync(directory).filter(n => /^(class|race|species|ancestry|heritage|background)_.*\.rpg\.json$/.test(n)))
      files.set(`systems/${id}/resource_instances/${name}`, readFileSync(resolve(directory, name)));
    const headers = { 'access-control-allow-origin': '*' };
    await page.route('https://api.github.com/repos/blastervla/rpg-companion-app-systems/**', route => route.fulfill({ headers,
      json: route.request().url().includes('/commits?') ? [{ sha: commit, commit: { tree: { sha: treeSha } } }]
        : { sha: treeSha, truncated: false, tree: [...files].map(([path, bytes]) => ({ path, size: bytes.length, type: 'blob', mode: '100644' })) }
    }));
    await page.route('https://raw.githubusercontent.com/blastervla/rpg-companion-app-systems/**', route => {
      expect(route.request().url()).toContain('/' + commit + '/');
      const bytes = files.get(decodeURIComponent(route.request().url().split('/' + commit + '/')[1]));
      if (!bytes) return route.fulfill({ headers, status: 404, body: 'Unexpected path' });
      return route.fulfill({ headers, contentType: 'application/json', body: bytes });
    });
    await page.goto('./'); await navigate(page, copy.systems);
    await page.getByRole('button', { name: copy.importUrl, exact: true }).click();
    await page.getByLabel('URL del sistema o repository GitHub').fill('https://github.com/blastervla/rpg-companion-app-systems');
    await page.getByRole('button', { name: 'Carica anteprima', exact: true }).click();
    await page.getByRole('combobox', { name: 'Sistema disponibile', exact: true }).selectOption(id);
    await page.getByLabel('Sistema compilato da file', { exact: true }).setInputFiles(resolve(releases, `${id}-system.rpg`));
    await page.getByRole('button', { name: 'Carica sistema e cataloghi', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Prima di importare', exact: true })).toContainText(
      `Modelli di catalogo: ${expected} · Modelli non assegnabili: ${blocked}`, { timeout: 30000 });
    await page.getByRole('button', { name: 'Conferma importazione', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 30000 });
    if (id !== 'pf2e') {
      await waitForWorker(page);
      await page.evaluate(() => new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open('sheetcore');
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const database = opening.result, transaction = database.transaction('resources', 'readwrite');
          transaction.onerror = () => { database.close(); reject(transaction.error); };
          transaction.onabort = () => { database.close(); reject(transaction.error); };
          transaction.oncomplete = () => { database.close(); resolve(); };
          const store = transaction.objectStore('resources'), reading = store.getAll();
          reading.onsuccess = () => {
            const records: { name: string; catalogSource?: unknown; catalogIssue?: string }[] = reading.result;
            const druid = records.find(r => r.name === 'Druid' && r.catalogSource);
            if (!druid) { transaction.abort(); return; }
            druid.catalogIssue = 'Old parser did not support remove_ids'; store.put(druid);
          };
        };
      }));
      await context.setOffline(true); await page.reload();
      await navigate(page, 'Risorse');
      // The archive mounts one 50-card page; search reaches entries beyond it.
      await page.getByLabel(copy.searchResources, { exact: true }).fill('Druid');
      const druid = page.locator('.resource-card').filter({ has: page.getByRole('heading', { name: 'Druid', exact: true }) });
      await expect(druid).toHaveCount(1);
      await expect(druid).not.toContainText(copy.catalogUnavailable);
    }
    await create(page, 'Cataloghi originali');
    const aside = page.locator('.sheet-aside'), className = id === 'pf2e' ? 'Fighter' : 'Druid';
    await aside.getByRole('combobox', { name: 'Classe da aggiungere', exact: true }).selectOption({ label: className });
    await aside.getByRole('button', { name: 'Aggiungi classe', exact: true }).click();
    const level = aside.getByRole('spinbutton', { name: `Livello manuale · ${className}`, exact: true });
    await expect(level).toHaveValue('1');
    const origin = aside.getByRole('combobox', { name: id === 'pf2e' ? 'Ancestry' : 'Race', exact: true });
    await origin.selectOption({ label: 'Human' }); await expect(origin).not.toHaveValue('');
    await waitForWorker(page); await context.setOffline(true); await page.reload();
    await page.getByRole('button', { name: /Cataloghi originali/ }).click();
    await expect(level).toHaveValue('1');
    await navigate(page, 'Impostazioni');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Esporta backup', exact: true }).click();
    const backup = readFileSync((await (await download).path())!, 'utf8'), data = JSON.parse(backup);
    const templates = data.resources.filter((r: { catalogSource?: unknown }) => r.catalogSource);
    expect(templates).toHaveLength(expected);
    for (const record of templates)
      expect(Buffer.from(record.catalogSource.original)).toEqual(files.get(record.catalogSource.source.split('/' + commit + '/')[1]));
    await page.locator('input[type=file]').setInputFiles({ name: 'real-catalogs.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await page.getByRole('button', { name: 'Sostituisci archivio', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: /Cataloghi originali/ }).click();
    await expect(level).toHaveValue('1');
    if (id === '5e2024') return;
    // One command reaches the maximum level and summarizes the gains: 5e with the imported subclass,
    // PF2e with HP derived from levels and no dice or subclass list.
    await page.getByRole('button', { name: copy.progression, exact: true }).click();
    const advance = page.getByRole('dialog', { name: copy.progression });
    await advance.getByRole('button', { name: copy.progressionMax(20), exact: true }).click();
    await expect(advance.getByLabel(copy.progressionTarget, { exact: true })).toHaveValue('20');
    if (id === '5e') await advance.getByRole('combobox', { name: copy.progressionArchetype }).selectOption({ index: 1 });
    else await expect(advance.getByText(copy.progressionHpDerived)).toBeVisible();
    await expect(advance.getByText(copy.progressionGains(20))).toBeVisible();
    await advance.getByLabel(copy.progressionAcknowledge).check();
    await advance.locator('button[type=submit]').click();
    await expect(advance.locator('.progression-saved')).toContainText(copy.progressionSaved);
    await expect(advance.getByText(id === '5e' ? 'Archdruid' : 'Weapon Legend', { exact: true }).first()).toBeVisible();
    if (id === 'pf2e') {
      // Open level choices are the source's grants; a boost is assigned there and applied by its commit program.
      const choices = advance.locator('.progression-choices');
      await expect(choices.getByText(/scelte aperte fino al tuo livello/)).toBeVisible();
      // A completed grant leaves the open list, so the open count drops once the write lands.
      const open = async () => Number((await choices.getByText(/scelte aperte fino al tuo livello/).innerText()).match(/^\d+/)![0]);
      const before = await open();
      await choices.getByRole('checkbox', { name: 'Strength', exact: true }).first().click();
      await expect.poll(open).toBe(before - 1);
      await choices.getByRole('button', { name: copy.progressionApplyChoices, exact: true }).click();
      await expect(choices.getByRole('status')).toHaveText(copy.progressionChoicesApplied);
    } else {
      // Druid ASI levels from the source's should_show_asi: 4, 8, 12, 16, 19; the first takes +2 Wisdom.
      const increases = advance.locator('.progression-asi');
      await expect(increases).toHaveCount(5);
      const first = increases.first();
      await expect(first.locator('legend')).toHaveText(copy.progressionAsiLevel(4));
      await first.getByLabel(copy.progressionAsiFirst).selectOption({ label: 'Wisdom' });
      await first.getByLabel(copy.progressionAsiSecond).selectOption({ label: 'Wisdom' });
      await first.getByRole('button', { name: copy.progressionApplyChoices, exact: true }).click();
      await expect(first.getByRole('status')).toHaveText(copy.progressionChoicesApplied);
      await expect(first.getByRole('button', { name: copy.progressionApplyChoices, exact: true })).toBeDisabled();
    }
    await expect(advance.getByText(copy.progressionNothingRecovered)).toBeVisible();
    await advance.locator('.modal-actions').getByRole('button', { name: copy.close, exact: true }).click();
    await expect(level).toHaveValue('20');
  });
}

if (process.env.LIVE_REPOSITORY_IMPORT === '1') {
  test('live published repository discovers systems and downloads actual catalogs without interception', async ({ page, context }) => {
    test.setTimeout(120000);
    await page.goto('./'); await navigate(page, copy.systems);
    await page.getByRole('button', { name: copy.importUrl, exact: true }).click();
    await page.getByLabel('URL del sistema o repository GitHub').fill('https://github.com/blastervla/rpg-companion-app-systems');
    await page.getByRole('button', { name: 'Carica anteprima', exact: true }).click();
    const systems = page.getByRole('combobox', { name: 'Sistema disponibile', exact: true });
    await expect(systems.locator('option')).toContainText(['5e', '5.5e', 'Pathfinder 2e'], { timeout: 20000 });
    await systems.selectOption('5e2024');
    await page.getByLabel('Sistema compilato da file', { exact: true }).setInputFiles(resolve('.reference/official-releases-2026-11-16/5e2024-system.rpg'));
    await page.getByRole('button', { name: 'Carica sistema e cataloghi', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Prima di importare', exact: true })).toContainText('Modelli di catalogo:', { timeout: 60000 });
    const rawSource = await page.getByRole('dialog').locator('details li .muted').first().textContent();
    const pinnedCommit = /raw\.githubusercontent\.com\/blastervla\/rpg-companion-app-systems\/([a-f0-9]{40})\//.exec(rawSource ?? '')?.[1];
    expect(pinnedCommit).toMatch(/^[a-f0-9]{40}$/);
    await page.getByRole('button', { name: 'Conferma importazione', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 30000 });
    await navigate(page, 'Risorse');
    const before = 74;
    // Only one 50-card page is mounted; the status line carries the full count.
    await expect(page.getByTestId('resource-count')).toHaveText(`${before} risorse`);
    await expect(page.locator('.resource-card')).toHaveCount(50);
    await openCatalogImport(page);
    await page.getByLabel(copy.catalogUrl, { exact: true }).fill(`https://github.com/blastervla/rpg-companion-app-systems/tree/${pinnedCommit}/systems/5e2024/resource_instances`);
    await page.getByRole('button', { name: copy.catalogFromUrl, exact: true }).click();
    await expect(page.getByRole('dialog', { name: copy.catalogPreview, exact: true })).toBeVisible({ timeout: 60000 });
    await page.getByRole('dialog').getByRole('button', { name: copy.confirmImport, exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 30000 });
    // Only one 50-card page is mounted; the status line carries the full count.
    await expect(page.getByTestId('resource-count')).toHaveText(`${before} risorse`);
    await expect(page.locator('.resource-card')).toHaveCount(50);
    await create(page, 'Repository live');
    const aside = page.locator('.sheet-aside');
    await aside.getByRole('combobox', { name: 'Classe da aggiungere', exact: true }).selectOption({ label: 'Wizard' });
    await aside.getByRole('button', { name: 'Aggiungi classe', exact: true }).click();
    await expect(aside.getByRole('spinbutton', { name: 'Livello manuale · Wizard', exact: true })).toHaveValue('1');
    await waitForWorker(page); await context.setOffline(true); await page.reload();
    await page.getByRole('button', { name: /Repository live/ }).click();
    await expect(aside.getByRole('spinbutton', { name: 'Livello manuale · Wizard', exact: true })).toHaveValue('1');
  });
}

test('local catalog file preview cancels safely and exports the exact immutable original', async ({ page }) => {
  await page.goto('./'); await importJson(page, JSON.stringify(catalogSystem)); await navigate(page, 'Risorse');
  const input = page.getByLabel('File catalogo JSON', { exact: true });
  const files = [
    { name: 'class.rpg.json', mimeType: 'application/json', buffer: Buffer.from(classOriginal) },
    { name: 'race.rpg.json', mimeType: 'application/json', buffer: Buffer.from(raceOriginal) }
  ];
  await input.setInputFiles(files);
  await expect(page.getByRole('dialog', { name: 'Anteprima cataloghi', exact: true })).toContainText('Viandante');
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(page.locator('article.resource-card')).toHaveCount(0);
  await input.setInputFiles(files);
  await page.getByRole('button', { name: 'Conferma importazione', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('article.resource-card')).toHaveCount(2);
  const card = page.locator('article.resource-card').filter({ has: page.getByRole('heading', { name: 'Viandante', exact: true }) });
  await expect(card.getByRole('button', { name: 'Modifica', exact: true })).toHaveCount(0);
  const download = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Esporta catalogo originale', exact: true }).click();
  expect(readFileSync((await (await download).path())!, 'utf8')).toBe(classOriginal);
});

test('background and subrace selections retain upstream IDs through offline use and backup', async ({ page, context }) => {
  await page.goto('./'); await importJson(page, JSON.stringify(catalogSystem)); await navigate(page, 'Risorse');
  await page.getByLabel(copy.catalogFiles, { exact: true }).setInputFiles([
    { name: 'background.json', mimeType: 'application/json', buffer: Buffer.from(backgroundOriginal) },
    { name: 'race.json', mimeType: 'application/json', buffer: Buffer.from(subraceOriginal) },
    { name: 'other-race.json', mimeType: 'application/json', buffer: Buffer.from(raceOriginal) }
  ]);
  await page.getByRole('dialog').getByRole('button', { name: copy.confirmImport, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await create(page, 'Origini conservate');
  const aside = page.locator('.sheet-aside');
  const background = aside.getByRole('combobox', { name: 'background', exact: true });
  const race = aside.getByRole('combobox', { name: 'race', exact: true });
  const subrace = aside.getByRole('combobox', { name: 'subrace_id', exact: true });
  await expect(subrace).toBeDisabled();
  await background.selectOption({ label: 'Cartografo' });
  await race.selectOption({ label: 'Valle' });
  await expect(subrace.getByRole('option')).toHaveText([copy.choose, 'Riva']);
  await subrace.selectOption('upstream-subrace');
  await expect(subrace).toHaveValue('upstream-subrace');
  await page.getByText(copy.baseValues, { exact: true }).click();
  await page.getByRole('textbox', { name: 'subrace_id', exact: true }).fill('legacy-unmatched');
  await page.getByRole('textbox', { name: 'subrace_id', exact: true }).press('Tab');
  await expect(subrace).toHaveValue('legacy-unmatched');
  await expect(subrace).toContainText(copy.unknownSubrace);
  await subrace.selectOption('upstream-subrace');
  await waitForWorker(page); await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: /Origini conservate/ }).click();
  await expect(subrace).toHaveValue('upstream-subrace');
  await expect(background.locator('option:checked')).toHaveText('Cartografo');
  await navigate(page, 'Impostazioni');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: copy.export, exact: true }).click();
  const text = readFileSync((await (await downloading).path())!, 'utf8'), data = JSON.parse(text);
  expect(data.characters[0].values.subrace_id).toBe('upstream-subrace');
  expect(data.resources.find((r: { catalogSource?: { original: string } }) => r.catalogSource?.original === backgroundOriginal)).toBeTruthy();
  await page.getByLabel(copy.restore, { exact: true }).setInputFiles({ name: 'origins.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.getByRole('button', { name: copy.confirmRestore, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: /Origini conservate/ }).click();
  await expect(subrace).toHaveValue('upstream-subrace');
  await race.selectOption({ label: 'Collina' });
  await expect(subrace).toHaveValue('');
  await expect(subrace).toContainText(copy.noSubraces);
  await expect(background.locator('option:checked')).toHaveText('Cartografo');
  await race.selectOption('');
  await expect(subrace).toBeDisabled();
  await background.selectOption('');
  await expect(background).toHaveValue('');
});

test('grimoire theme, local fonts and responsive navigation preserve every destination', async ({ page }, testInfo) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.workspace-label, .topbar-right, .sidebar-bottom, .local-note')).toHaveCount(0);
  await importJson(page, demoOriginal, false);
  const centered = await page.getByRole('dialog').evaluate(el => {
    const rect = el.getBoundingClientRect();
    return Math.abs(rect.x + rect.width / 2 - innerWidth / 2) < 2
      && Math.abs(rect.y + rect.height / 2 - innerHeight / 2) < 2;
  });
  expect(centered).toBe(true);
  await page.getByRole('button', { name: copy.confirmImport, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await create(page, 'Mira di Rocca');
  await expect(page.getByText(copy.offlineReady, { exact: true })).toBeVisible();
  await page.locator('.notification').getByRole('button', { name: copy.close, exact: true }).click();
  await page.locator('.notice-success').getByRole('button', { name: copy.close, exact: true }).click();
  await expect(page.locator('.page-heading .eyebrow')).toHaveCount(0);
  await captureInterface(page, `${testInfo.project.name}-sheet`);
  await create(page, 'Lupo delle Felci');
  await navigate(page, 'Personaggi');
  // Two characters of one game: nothing to narrow down, so no search or system filters.
  await expect(page.locator('.character-card')).toHaveCount(2);
  await expect(page.getByLabel(copy.search, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sentieri 2', exact: true })).toHaveCount(0);
  await page.evaluate(async () => { await document.fonts.ready; });
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Plus Jakarta Sans');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await captureInterface(page, `${testInfo.project.name}-characters`);
  if (testInfo.project.name === 'mobile') {
    const tabs = page.getByRole('navigation', { name: copy.mobileNavigation });
    await expect(tabs).toBeVisible();
    await tabs.getByRole('button', { name: copy.dice, exact: true }).click();
    await expect(page.getByRole('heading', { name: copy.dice, level: 1 })).toBeVisible();
    await tabs.getByRole('button', { name: copy.more, exact: true }).click();
    await expect(page.locator('.sidebar')).toBeVisible();
    await page.locator('.sidebar').getByRole('button', { name: copy.resources, exact: true }).click();
    await expect(page.getByRole('heading', { name: copy.resources, level: 1 })).toBeVisible();
  }
  await navigate(page, copy.systems);
  await captureInterface(page, `${testInfo.project.name}-systems`);
  await navigate(page, 'Dadi');
  await page.getByRole('button', { name: copy.roll, exact: true }).click();
  await expect(page.locator('.dice-result output')).toBeVisible();
  await captureInterface(page, `${testInfo.project.name}-dice`);
  await waitForWorker(page);
  const cached = await page.evaluate(async () => Promise.all(
    ['eb-garamond-latin', 'plus-jakarta-sans-latin', 'space-mono-latin', 'space-mono-bold-latin']
      .map(async f => !!await caches.match(new URL(`fonts/${f}.woff2`, location.href).href, { ignoreSearch: true }))));
  expect(cached).toEqual([true, true, true, true]);
  await navigate(page, 'Impostazioni');
  await expect(page.locator('.privacy-panel')).toHaveCount(0);
  await page.getByRole('button', { name: copy.light, exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.character-card')).toHaveCount(2);
  await expect.poll(() => page.locator('.character-card').first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 254, 251)');
  await captureInterface(page, `${testInfo.project.name}-light`);
});

for (const kind of ['json', 'web-folder', 'github-folder']) {
  test(`resource link ${kind} reviews originals, cancels, deduplicates, rejects partial batches and survives offline backup`, async ({ page, context }) => {
    const commit = 'a'.repeat(40), treeSha = 'b'.repeat(40);
    const sources: Record<string, string> = { 'catalog/class.json': classOriginal, 'catalog/race.json': raceOriginal };
    let broken = false;
    await page.route('https://catalog.polysheet.test/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const body = path.endsWith('index.json') ? JSON.stringify({ files: ['class.json', 'race.json'] })
        : path.endsWith('class.json') ? classOriginal : raceOriginal;
      await route.fulfill({ status: broken && path.endsWith('race.json') ? 503 : 200,
        body, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    });
    await page.route('https://api.github.com/repos/catalog-owner/library/**', async route => {
      await route.fulfill({ json: route.request().url().includes('/commits?')
        ? [{ sha: commit, commit: { tree: { sha: treeSha } } }]
        : { sha: treeSha, truncated: false, tree: Object.entries(sources).map(([path, original]) =>
          ({ path, size: Buffer.byteLength(original), type: 'blob', mode: '100644' })) } });
    });
    await page.route(`https://raw.githubusercontent.com/catalog-owner/library/${commit}/**`, async route => {
      const path = new URL(route.request().url()).pathname.split('/').slice(4).join('/');
      await route.fulfill({ status: broken && path.endsWith('race.json') ? 503 : 200,
        body: sources[path] ?? '', contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    });
    await page.goto('./'); await importJson(page, JSON.stringify(catalogSystem)); await navigate(page, 'Risorse');
    const link = kind === 'json' ? 'https://catalog.polysheet.test/class.json'
      : kind === 'web-folder' ? 'https://catalog.polysheet.test/catalog/'
        : 'https://github.com/catalog-owner/library/tree/main/catalog';
    const count = kind === 'json' ? 1 : 2;
    await openCatalogImport(page);
    await page.getByLabel(copy.catalogUrl, { exact: true }).fill(link);
    await page.getByRole('button', { name: copy.catalogFromUrl, exact: true }).click();
    const preview = page.getByRole('dialog', { name: copy.catalogPreview, exact: true });
    await expect(preview).toContainText('Viandante');
    await expect(preview).toContainText(kind === 'github-folder' ? commit : 'catalog.polysheet.test');
    await preview.getByRole('button', { name: copy.cancel, exact: true }).click();
    await expect(page.locator('article.resource-card')).toHaveCount(0);
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: copy.catalogFromUrl, exact: true }).click();
      await expect(preview).toBeVisible();
      await preview.getByRole('button', { name: copy.confirmImport, exact: true }).click();
      await expect(preview).not.toBeVisible();
      await expect(page.locator('article.resource-card')).toHaveCount(count);
    }
    broken = true;
    if (kind === 'json') await page.getByLabel(copy.catalogUrl, { exact: true }).fill('https://catalog.polysheet.test/catalog/');
    await page.getByRole('button', { name: copy.catalogFromUrl, exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('HTTP 503');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('article.resource-card')).toHaveCount(count);
    await waitForWorker(page, copy.error); await context.setOffline(true); await page.reload();
    await navigate(page, 'Risorse'); await expect(page.locator('article.resource-card')).toHaveCount(count);
    await navigate(page, 'Impostazioni');
    const event = page.waitForEvent('download'); await page.getByRole('button', { name: copy.export, exact: true }).click();
    const backup = readFileSync((await (await event).path())!, 'utf8'), data = JSON.parse(backup);
    expect(data.resources).toHaveLength(count);
    expect(data.resources.find((r: { definitionId: string }) => r.definitionId === 'class').catalogSource.original).toBe(classOriginal);
    await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await page.getByRole('button', { name: copy.confirmRestore, exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await navigate(page, 'Risorse'); await expect(page.locator('article.resource-card')).toHaveCount(count);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('system removal cancels safely, protects pinned versions, removes related catalogs and restores them from backup offline', async ({ page, context }) => {
  const original = JSON.stringify(catalogSystem), digest = createHash('sha256').update(original).digest('hex');
  const otherDigest = createHash('sha256').update(original + '\n').digest('hex');
  const remove = (hash: string) => page.getByRole('button', { name: `${copy.removeSystem} ${catalogSystem.name} · ${hash.slice(0, 6)}`, exact: true });
  await page.goto('./'); await importJson(page, original); await navigate(page, 'Risorse');
  await page.getByLabel(copy.catalogFiles, { exact: true }).setInputFiles([
    { name: 'class.json', mimeType: 'application/json', buffer: Buffer.from(classOriginal) },
    { name: 'race.json', mimeType: 'application/json', buffer: Buffer.from(raceOriginal) }
  ]);
  await page.getByRole('button', { name: copy.confirmImport, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(page.locator('.resource-card')).toHaveCount(2);
  await importJson(page, original + '\n'); await create(page, 'Personaggio da conservare', `${catalogSystem.id}@${catalogSystem.version}:${otherDigest}`);
  await navigate(page, 'Impostazioni');
  const event = page.waitForEvent('download'); await page.getByRole('button', { name: copy.export, exact: true }).click();
  const backup = readFileSync((await (await event).path())!, 'utf8');
  expect(JSON.parse(backup).systems).toHaveLength(2);
  await navigate(page, copy.systems); await remove(digest).click();
  let modal = page.getByRole('dialog', { name: copy.removeSystemTitle, exact: true });
  await expect(modal).toContainText(digest);
  await modal.getByRole('button', { name: copy.cancel, exact: true }).click();
  await expect(page.locator('.system-card')).toHaveCount(2);
  await remove(otherDigest).click();
  await page.getByRole('dialog').getByRole('button', { name: copy.removeSystem, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('alert')).toContainText(copy.systemInUse);
  await expect(page.locator('.system-card')).toHaveCount(2);
  await remove(digest).click();
  await page.getByRole('dialog').getByRole('button', { name: copy.removeSystem, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(page.locator('.system-card')).toHaveCount(1);
  await expect(remove(otherDigest)).toBeVisible();
  await waitForWorker(page); await context.setOffline(true); await page.reload(); await navigate(page, 'Impostazioni');
  const afterEvent = page.waitForEvent('download'); await page.getByRole('button', { name: copy.export, exact: true }).click();
  const after = JSON.parse(readFileSync((await (await afterEvent).path())!, 'utf8'));
  expect(after.systems).toHaveLength(1); expect(after.systems[0].digest).toBe(otherDigest);
  expect(after.characters).toHaveLength(1); expect(after.resources).toHaveLength(0);
  await page.locator('input[type=file]').setInputFiles({ name: 'before-removal.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByRole('button', { name: copy.confirmRestore, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await navigate(page, copy.systems); await expect(page.locator('.system-card')).toHaveCount(2);
  await navigate(page, 'Risorse');
  await page.getByRole('combobox', { name: copy.chooseSystem, exact: true }).selectOption(`${catalogSystem.id}@${catalogSystem.version}:${digest}`);
  await expect(page.locator('.resource-card')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
