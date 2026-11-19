/** @file Original 5e item card actions through production controls, without direct database writes. */
import { expect, type Page } from '@playwright/test';
import { it } from '../../src/ui/it';

/** Exercise default/custom Amount, repeated changes, zero unlinking and reload persistence. */
export async function verifyItemQuantity(page: Page) {
  const entry = page.locator('.source-resource-item').filter({ has: page.getByText('Corda manuale', { exact: true }) });
  const details = entry.getByRole('button', { name: 'Dettagli · Item', exact: true });
  await details.click();
  const card = page.getByRole('dialog', { name: 'Item', exact: true });
  const amount = card.getByRole('spinbutton', { name: 'Edit quantity', exact: true });
  const quantity = card.getByRole('button', { name: 'Modifica Quantity', exact: true });
  async function apply(name: string) {
    await card.getByRole('button', { name, exact: true }).click();
    const result = page.getByRole('dialog', { name: it.eventApplied, exact: true });
    await result.getByRole('button', { name: it.close, exact: true }).click();
    await expect(result).not.toBeVisible();
  }
  await expect(amount).toHaveValue('1');
  await expect(quantity).toHaveText('1');
  await apply('+ ADD');
  await expect(quantity).toHaveText('2');
  await amount.fill('3');
  await amount.press('Tab');
  await apply('+ ADD');
  await expect(quantity).toHaveText('5');
  await apply('+ REMOVE');
  await expect(quantity).toHaveText('2');
  await amount.fill('1');
  await amount.press('Tab');
  await apply('+ REMOVE');
  await expect(quantity).toHaveText('1');
  await apply('+ REMOVE');
  if (await card.isVisible()) await card.getByRole('button', { name: it.close, exact: true }).first().click();
  await expect(details).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: /Mira · configurata/ }).click();
  await expect(details).toHaveCount(0);
}
