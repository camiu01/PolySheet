/** @file Shared Playwright helpers for production-control flows. */
import { expect, type Locator, type Page } from '@playwright/test';
import { it as copy } from '../../src/ui/it';

/**
 * Pick the first installed game. A single non-demo game is preselected,
 * so the placeholder option is absent and nothing needs to be chosen.
 */
export async function chooseGame(game: Locator) {
  if (await game.locator('option').count() > 1) await game.selectOption({ index: 1 });
}

/** Pick the first game and leave the guided flow that systems with creation pages open by default. */
export async function chooseManualGame(game: Locator) {
  await chooseGame(game);
  const page = game.page();
  const manual = page.getByText(copy.manual, { exact: true });
  const useManual = page.getByRole('button', { name: copy.useManualSetup, exact: true });
  await expect(manual.or(useManual)).toBeVisible();
  if (await useManual.isVisible()) await useManual.click();
  await expect(manual).toBeVisible();
}

/** Open the folded catalog importer on the Risorse page. */
export async function openCatalogImport(page: Page) {
  const disclosure = page.locator('details.catalog-import-disclosure');
  if (!await disclosure.evaluate(node => (node as HTMLDetailsElement).open)) await disclosure.locator(':scope > summary').click();
}
