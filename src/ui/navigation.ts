/** @file Same-document browser history for local screens; no domain data goes into URLs. */
import { useUi, type Page } from './store';

const pages: Page[] = ['characters', 'systems', 'resources', 'dice', 'combat', 'diagnostics', 'settings'];

/** Track screen/character transitions without trapping Back at the app's entry page. */
export function connectNavigation() {
  let restoring = false;
  const route = () => {
    const { page, characterId, systemKey } = useUi.getState();
    return { page, characterId, systemKey };
  };
  window.history.replaceState({ ...window.history.state, polysheet: route() }, '');
  const unsubscribe = useUi.subscribe((current, previous) => {
    if (restoring) return;
    const state = { ...window.history.state, polysheet: route() };
    if (current.page !== previous.page || current.characterId !== previous.characterId)
      window.history.pushState(state, '');
    else if (current.systemKey !== previous.systemKey) window.history.replaceState(state, '');
  });
  const restore = (event: PopStateEvent) => {
    const value = event.state?.polysheet;
    if (!value || !pages.includes(value.page) || typeof value.systemKey !== 'string'
      || (value.characterId !== null && typeof value.characterId !== 'string')) return;
    restoring = true;
    try { useUi.setState({ page: value.page, characterId: value.characterId, systemKey: value.systemKey }); }
    finally { restoring = false; }
  };
  window.addEventListener('popstate', restore);
  return () => { unsubscribe(); window.removeEventListener('popstate', restore); };
}
