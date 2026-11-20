/** @file Interface locale detection, switching and catalogue parity. */
import { afterEach, describe, expect, it as test } from 'vitest';
import { currentLocale, detectLocale, it as copy, setLocale, supportedLocales } from '../src/ui/i18n';
import { en } from '../src/ui/locales/en';
import { it as italian } from '../src/ui/locales/it';

describe('interface locale', () => {
  afterEach(() => setLocale('it'));
  test('keeps the same keys in every catalogue', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(italian).sort());
    for (const key of Object.keys(italian) as (keyof typeof italian)[]) expect(typeof en[key]).toBe(typeof italian[key]);
  });
  test('resolves interface copy through the active locale', () => {
    expect(copy.save).toBe('Salva');
    setLocale('en');
    expect(copy.save).toBe('Save');
    expect(copy.characters).toBe('Characters');
    expect(copy.progressionGains(3)).toBe('At class level 3 you gain');
  });
  test('detects Italian and English browser languages', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis.navigator, 'languages');
    try {
      Object.defineProperty(globalThis.navigator, 'languages', { value: ['en-US', 'en'], configurable: true });
      expect(detectLocale()).toBe('en');
      Object.defineProperty(globalThis.navigator, 'languages', { value: ['it-IT', 'it'], configurable: true });
      expect(detectLocale()).toBe('it');
    } finally {
      if (original) Object.defineProperty(globalThis.navigator, 'languages', original);
    }
    expect(currentLocale()).toBe('it');
    expect(supportedLocales).toEqual(['it', 'en']);
  });
});
