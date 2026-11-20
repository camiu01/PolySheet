/** @file Responsive grimoire shell. Persistent domain data is read directly from Dexie. */
import { Component, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { BookOpen, Check, Dices, Download, FolderOpen, Hexagon, LayoutGrid, Menu, Settings2, ShieldCheck, X } from 'lucide-react';
import { db, defaultPreferences } from './persistence/db';
import { refreshCatalogIssues } from './persistence/catalog';
import { refreshSystemDiagnostics } from './persistence/diagnostics';
import { Characters, CharacterSheet } from './ui/Characters';
import { Library } from './ui/Library';
import { Diagnostics, DicePage, Resources, Settings } from './ui/Tools';
import { CombatTracker } from './ui/CombatTracker';
import { diagnose } from './importing/system';
import './ui/fields.css';
import { useUi, type Page } from './ui/store';
import { connectNavigation } from './ui/navigation';
import { it, detectLocale, setLocale } from './ui/it';
import { useLocale } from './ui/i18n';
import type { Run } from './ui/shared';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
const pages = [
  { id: 'characters', icon: LayoutGrid },
  { id: 'systems', icon: BookOpen },
  { id: 'resources', icon: FolderOpen },
  { id: 'dice', icon: Dices },
  { id: 'combat', icon: ShieldCheck }
] as const;

/** Render offline status, navigation, update prompts, and the selected local screen. */
export default function App() {
  // Recompute capabilities after an app update without rewriting source imports.
  const systems = useLiveQuery(async () => (await db.systems.toArray()).map(s => ({ ...s, diagnostics: diagnose(s.definition) })), []) ?? [];
  const characters = useLiveQuery(() => db.characters.orderBy('updatedAt').reverse().toArray(), []) ?? [];
  const preferences = useLiveQuery(() => db.preferences.get('app'), []) ?? defaultPreferences;
  // The stored choice wins; the browser language applies only until the user picks one.
  const locale = useLocale(state => state.locale);
  const preferredLocale = preferences.locale ?? detectLocale();
  useEffect(() => { setLocale(preferredLocale); }, [preferredLocale]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const { page, characterId, systemKey, navigate } = useUi();
  const [menu, setMenu] = useState(false);
  const [pending, setPending] = useState(0);
  const [notification, setNotification] = useState<{ text: string; error: boolean } | null>(null);
  useEffect(connectNavigation, []);
  useEffect(() => { setMenu(false); }, [page, characterId]);
  const entered = useRef(false);
  // A new destination starts at its top with focus on its heading (or main), never at the old scroll offset.
  useEffect(() => {
    if (!entered.current) { entered.current = true; return; }
    window.scrollTo({ top: 0 });
    const frame = requestAnimationFrame(() => {
      const main = document.getElementById('main');
      const heading = main?.querySelector<HTMLElement>('h1');
      if (heading && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      (heading ?? main)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [page, characterId]);
  const drawer = useRef<HTMLElement>(null), opener = useRef<HTMLElement | null>(null);
  // The drawer is modal only below the shell breakpoint; widening the window closes it.
  useEffect(() => {
    if (!menu) return;
    const query = window.matchMedia('(max-width: 760px)');
    const close = () => { if (!query.matches) setMenu(false); };
    query.addEventListener('change', close);
    drawer.current?.querySelector<HTMLElement>('.drawer-close')?.focus();
    return () => {
      query.removeEventListener('change', close);
      // The close button unmounts with the drawer, so focus may already have dropped to <body>.
      const lost = document.activeElement === document.body || drawer.current?.contains(document.activeElement);
      if (opener.current?.isConnected && lost) opener.current.focus();
    };
  }, [menu]);
  // A tap does not focus the trigger on touch devices, so remember it explicitly for focus return.
  const toggleMenu = (event: { currentTarget: HTMLElement }) => { opener.current = event.currentTarget; setMenu(!menu); };
  function trapDrawer(event: KeyboardEvent<HTMLElement>) {
    if (!menu) return;
    if (event.key === 'Escape') { event.preventDefault(); setMenu(false); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')].filter(item => item.offsetParent !== null);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const { needRefresh: [needRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW({
    onRegisterError(error) { setNotification({ text: `Service worker: ${String(error)}`, error: true }); }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.style.colorScheme = preferences.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', preferences.theme === 'dark' ? '#111417' : '#f6f4ee');
  }, [preferences.theme]);
  useEffect(() => {
    const install = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallEvent); };
    window.addEventListener('beforeinstallprompt', install);
    return () => {
      window.removeEventListener('beforeinstallprompt', install);
    };
  }, []);
  const run = useCallback<Run>(async (work, success) => {
    setPending(n => n + 1);
    setNotification(previous => previous?.error ? null : previous);
    try { await work(); if (success) setNotification({ text: success, error: false }); }
    catch (error) { setNotification({ text: error instanceof Error ? error.message : String(error), error: true }); }
    finally { setPending(n => n - 1); }
  }, []);
  useEffect(() => { void run(async () => { await refreshSystemDiagnostics(); await refreshCatalogIssues(); }); }, []);
  const selectedSystem = systems.find(s => s.key === systemKey) ?? systems[0];
  const character = characters.find(c => c.id === characterId);
  const characterSystem = systems.find(s => s.key === character?.systemKey);
  const go = (p: Page) => { navigate(p); setMenu(false); };
  return <div className="app-shell">
    <a className="skip-link" href="#main">{it.skipToContent}</a>
    {menu && <button className="nav-backdrop" aria-label={it.close} onClick={() => setMenu(false)} />}
    <aside id="main-navigation" ref={drawer} className={`sidebar ${menu ? 'sidebar-open' : ''}`} onKeyDown={trapDrawer}
      role={menu ? 'dialog' : undefined} aria-modal={menu || undefined} aria-label={menu ? it.mainNavigation : undefined}>
      {menu && <button type="button" className="icon-button drawer-close" aria-label={it.closeNavigation} onClick={() => setMenu(false)}><X size={20} /></button>}
      <button className="brand" onClick={() => go('characters')} aria-label={`${it.brand} · ${it.characters}`}><span className="brand-symbol"><Hexagon size={27} /><span /></span><strong>{it.brand}<span>{it.tagline}</span></strong></button>
      <div className="nav-section-label">{it.atTheTable}</div>
      <nav aria-label={it.mainNavigation}>{pages.map(p => <button key={p.id} onClick={() => go(p.id)} className={`nav-item ${page === p.id ? 'active' : ''}`} aria-current={page === p.id ? 'page' : undefined}><p.icon size={19} />{it[p.id]}{p.id === 'characters' && <span className="nav-count">{characters.length}</span>}</button>)}</nav>
      <div className="nav-section-label second-label">{it.workspace}</div>
      <nav aria-label={it.workspace}>{[
        { id: 'diagnostics', label: it.diagnostics, icon: ShieldCheck },
        { id: 'settings', label: it.settings, icon: Settings2 }
      ].map(p => <button key={p.id} onClick={() => go(p.id as Page)} className={`nav-item ${page === p.id ? 'active' : ''}`} aria-current={page === p.id ? 'page' : undefined}><p.icon size={19} />{p.label}</button>)}</nav>
    </aside>
    <div className="main-shell" inert={menu || undefined}><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label={it.mainNavigation} aria-expanded={menu} onClick={toggleMenu}><Menu size={21} /></button><span>{it.mySpace}</span><span className="breadcrumb-slash">/</span><strong>{it[page]}</strong></div>
      <button className="mobile-brand" onClick={() => go('characters')}><Hexagon size={22} />{it.brand}</button>
      <span className="save-status" data-testid="save-status" role="status">{pending ? it.saving : notification?.error ? it.error : it.saved}</span>
      {installEvent && <button className="icon-button" aria-label={it.install} onClick={() => void run(async () => { await installEvent.prompt(); await installEvent.userChoice; setInstallEvent(null); })}><Download size={18} /></button>}</header>
      <main id="main" tabIndex={-1}>
        {notification && <div role={notification.error ? 'alert' : 'status'} className={`notification ${notification.error ? 'notification-error' : ''}`}><div><strong>{notification.error ? it.error : it.brand}</strong><p>{notification.text}</p></div><button className="icon-button" aria-label={it.close} onClick={() => setNotification(null)}><X size={18} /></button></div>}
        {needRefresh && <div className="notice update-notice"><p>{it.update}</p><button className="button secondary" onClick={() => void run(() => updateServiceWorker(true))}>{it.updateAction}</button></div>}
        {offlineReady && <div className="notice notice-success"><Check size={18} /><p>{it.offlineReady}</p><button className="icon-button" aria-label={it.close} onClick={() => setOfflineReady(false)}><X size={16} /></button></div>}
        {page === 'characters' && (character && characterSystem ? <CharacterSheet character={character} system={characterSystem} run={run} /> : <Characters systems={systems} characters={characters} run={run} />)}
        {page === 'systems' && <Library systems={systems} run={run} />}
        {page === 'resources' && <Resources systems={systems} system={selectedSystem} characters={characters} run={run} />}
        {page === 'dice' && <DicePage systems={systems} system={selectedSystem} preferences={preferences} run={run} />}
        {page === 'combat' && <CombatTracker systems={systems} system={selectedSystem} characters={characters} run={run} />}
        {page === 'diagnostics' && <Diagnostics systems={systems} system={selectedSystem} />}
        {page === 'settings' && <Settings preferences={preferences} run={run} />}
        <footer className="main-footer"><span>{it.brand} <span className="footer-separator">/</span> {it.footerTagline}</span><span>LOCAL-FIRST · OPEN SOURCE</span></footer>
      </main>
    </div>
    <nav className="mobile-tabs" aria-label={it.mobileNavigation} inert={menu || undefined}>
      {pages.filter(p => ['characters', 'systems', 'dice'].includes(p.id)).map(p => <button key={p.id}
        aria-current={page === p.id ? 'page' : undefined} onClick={() => go(p.id)}><p.icon size={21} /><span>{it[p.id]}</span></button>)}
      <button aria-label={it.more} aria-expanded={menu} aria-controls="main-navigation" onClick={toggleMenu}><Menu size={21} /><span>{it.more}</span></button>
    </nav>
  </div>;
}
/** Keep render/storage failures actionable instead of showing a blank screen. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() {
    if (this.state.error) return <main className="fatal-error"><h1>{it.error}</h1><p>{this.state.error}</p><p>{it.storageError}</p><button className="button primary" onClick={() => window.location.reload()}>{it.retry}</button></main>;
    return this.props.children;
  }
}
