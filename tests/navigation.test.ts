/** @file History tracks screens, not text edits, and restores without adding entries. */
import { afterEach, expect, it, vi } from 'vitest';
import { connectNavigation } from '../src/ui/navigation';
import { useUi } from '../src/ui/store';

afterEach(() => { vi.restoreAllMocks(); useUi.setState({ page: 'characters', characterId: null, systemKey: '', search: '' }); });

it('pushes actual page and character changes only, keeping the deployment URL intact', () => {
  const push = vi.spyOn(window.history, 'pushState');
  const url = window.location.href;
  const disconnect = connectNavigation();
  useUi.getState().navigate('systems');
  useUi.getState().navigate('systems');
  useUi.getState().selectSystem('demo-key');
  useUi.getState().setSearch('not a route');
  useUi.getState().openCharacter('character-id');
  expect(push).toHaveBeenCalledTimes(2);
  expect(window.history.state.polysheet).toEqual({ page: 'characters', characterId: 'character-id', systemKey: 'demo-key' });
  expect(window.location.href).toBe(url);
  window.dispatchEvent(new PopStateEvent('popstate', { state: { polysheet: { page: 'systems', characterId: null, systemKey: 'previous-key' } } }));
  expect(useUi.getState()).toMatchObject({ page: 'systems', characterId: null, systemKey: 'previous-key' });
  expect(push).toHaveBeenCalledTimes(2);
  disconnect();
  useUi.getState().navigate('resources');
  expect(push).toHaveBeenCalledTimes(2);
});

it('ignores unrelated or malformed history entries', () => {
  const disconnect = connectNavigation();
  for (const state of [null, {}, { polysheet: { page: 'outside', characterId: null, systemKey: '' } },
    { polysheet: { page: 'systems', characterId: {}, systemKey: '' } }])
    window.dispatchEvent(new PopStateEvent('popstate', { state }));
  expect(useUi.getState().page).toBe('characters');
  disconnect();
});
