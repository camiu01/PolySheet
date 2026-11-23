/** @file Source choices and compatibility review without changing import validation or persistence. */
import { ArrowRight, BookOpen, FolderOpen, Link, Upload } from 'lucide-react';
import type { Diagnostic } from '../domain/model';
import { groupDiagnostics } from '../importing/diagnostic-groups';
import { it } from './it';

/** Explain each source before opening a picker; the example stays a secondary path. */
export function SystemImportOptions({ onFile, onFolder, onLink, onDemo, busy }: {
  onFile: () => void; onFolder: () => void; onLink: () => void; onDemo?: () => void; busy: boolean;
}) {
  // One compact row of sources; the long limits live in the formats disclosure instead of every row.
  return <section className="system-import" aria-labelledby="system-import-heading">
    {onDemo && <aside className="import-demo" aria-labelledby="import-demo-heading">
      <BookOpen size={22} aria-hidden="true" />
      <div><h3 id="import-demo-heading">{it.demoTitle}</h3><p>{it.demoDescription}</p></div>
      <button className="button text-button" disabled={busy} onClick={onDemo}>{it.demoAction}<ArrowRight size={16} aria-hidden="true" /></button>
    </aside>}
    <h2 id="system-import-heading">{it.importSourceTitle}</h2>
    <p className="muted">{it.importBeforeConfirm}</p>
    <div className="import-source-choices">
      <button className="button secondary" disabled={busy} onClick={onFile} title={it.localFileHelp}><Upload size={18} aria-hidden="true" />{it.localFile}</button>
      <button className="button secondary" disabled={busy} onClick={onFolder} title={it.localFolderHelp}><FolderOpen size={18} aria-hidden="true" />{it.localFolder}</button>
      <button className="button secondary" disabled={busy} onClick={onLink} title={it.importLinkHelp}><Link size={18} aria-hidden="true" />{it.importUrl}</button>
    </div>
    <details className="import-format-help">
      <summary>{it.importFormatsTitle}</summary>
      <p><strong>{it.importFileTitle}.</strong> {it.localFileHelp}</p>
      <p><strong>{it.importFolderTitle}.</strong> {it.localFolderHelp}</p>
      <p><strong>{it.importLinkTitle}.</strong> {it.importLinkHelp}</p>
      <p>{it.importFormatsHelp}</p><p>{it.importCatalogHelp}</p>
    </details>
  </section>;
}

/** Count every diagnostic by topic; expand blocking errors and bound each detail list. */
export function ImportDiagnostics({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (!diagnostics.length) return null;
  return <div className="import-diagnostics">
    <p className="field-help">{it.importDiagnosticHelp}</p>
    {groupDiagnostics(diagnostics).map(group => <details className="import-diagnostic-group" key={group.category} open={group.category === 'error'}>
      <summary>{it.diagnosticGroups[group.category]} <span className="mono">({group.items.length})</span></summary>
      <p className="field-help">{it.diagnosticGroupNotes[group.category]}</p>
      <DiagnosticItems items={group.items} />
    </details>)}
  </div>;
}

/** Source key a path ends in, e.g. `$.combat.is_defeated` or `[6].list_view.subviews[1].on_tap_event`. */
function fieldName(path: string) {
  return /([A-Za-z_$][\w$]*)(?:\[\d+\])*$/.exec(path)?.[1] ?? path;
}

/**
 * One entry per distinct message: the message once, the source fields it concerns, and the exact
 * paths in a disclosure. Every diagnostic is still counted; only the path list is bounded.
 */
export function DiagnosticItems({ items }: { items: Diagnostic[] }) {
  const byMessage = new Map<string, Diagnostic[]>();
  for (const item of items) byMessage.set(item.message, [...(byMessage.get(item.message) ?? []), item]);
  let shown = 0;
  return <ul className="diagnostic-items">{[...byMessage].map(([message, entries]) => {
    const fields = [...new Set(entries.map(entry => fieldName(entry.path)))];
    const paths = entries.slice(0, Math.max(0, 100 - shown)); shown += paths.length;
    return <li key={message} className={entries[0].severity === 'error' ? 'error-text' : undefined}>
      <p>{message}{entries.length > 1 && <span className="muted"> ×{entries.length}</span>}</p>
      <p className="diagnostic-fields">{fields.slice(0, 12).map(field => <code key={field}>{field}</code>)}{fields.length > 12 && <span className="muted">+{fields.length - 12}</span>}</p>
      <details><summary>{it.diagnosticPaths}</summary>
        <ul>{paths.map((entry, index) => <li key={index}><code>{entry.path}</code></li>)}</ul>
        {paths.length < entries.length && <p className="field-help">{it.displayedDiagnostics}</p>}
      </details>
    </li>;
  })}</ul>;
}
