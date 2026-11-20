/** @file Active interface locale: browser detection, saved choice and translated catalogue lookup. */
import { create } from 'zustand';
import { en } from './locales/en';
import { it as italian, type Copy } from './locales/it';

export type Locale = 'it' | 'en';
export const supportedLocales: readonly Locale[] = ['it', 'en'];
const dictionaries: Record<Locale, Copy> = { it: italian, en };

/**
 * Resolve the first-run locale from the browser languages.
 * @remarks Outside a browser (Node, acceptance tests) the fallback is Italian, so test
 * processes and the pinned Italian browser locale agree on the same catalogue.
 */
export function detectLocale(): Locale {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'it';
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.some(language => typeof language === 'string' && language.toLowerCase().startsWith('it')) ? 'it' : 'en';
}

interface LocaleState { locale: Locale; set: (locale: Locale) => void }

export const useLocale = create<LocaleState>(set => ({
  locale: detectLocale(),
  set: locale => set({ locale })
}));

/** Switch the interface language without touching stored preferences. */
export function setLocale(locale: Locale) {
  useLocale.getState().set(locale);
}

export function currentLocale() {
  return useLocale.getState().locale;
}

/** Catalogue proxy: every read resolves against the active locale, so components need no locale prop. */
export const it = new Proxy({} as Copy, {
  get: (_target, key) => dictionaries[currentLocale()][key as keyof Copy],
  has: (_target, key) => key in dictionaries.it,
  ownKeys: () => Reflect.ownKeys(dictionaries.it),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true })
});
