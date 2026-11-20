/** @file Source choices and compatibility review without changing import validation or persistence. */
import { ArrowRight, BookOpen, FolderOpen, Link, Upload } from 'lucide-react';
import type { Diagnostic } from '../domain/model';
import { groupDiagnostics } from '../importing/diagnostic-groups';
import { it } from './it';

/** Explain each source before opening a picker; the example stays a secondary path. */
export function SystemImportOptions({ onFile, onFolder, onLink, onDemo, busy }: {
  onFile: () => void; onFolder: () => void; onLink: () => void; onDemo?: () => void; busy: boolean;
}) {
  return <section className="system-import" aria-labelledby="system-import-heading">
    <h2 id="system-import-heading">{it.importSourceTitle}</h2>
    <p className="muted">{it.importHelp}</p>
    <ol className="import-steps" aria-label={it.importSteps}>
      <li>{it.wizardSource}</li><li>{it.wizardPreview}</li><li>{it.wizardConfirm}</li>
    </ol>
    <div className="import-source-row">
      <Upload size={22} aria-hidden="true" />
      <div><h3>{it.importFileTitle}</h3><p>{it.localFileHelp}</p></div>
      <button className="button secondary" disabled={busy} onClick={onFile}>{it.localFile}</button>
    </div>
    <div className="import-source-row">
      <FolderOpen size={22} aria-hidden="true" />
      <div><h3>{it.importFolderTitle}</h3><p>{it.localFolderHelp}</p></div>
      <button className="button secondary" disabled={busy} onClick={onFolder}>{it.localFolder}</button>
    </div>
    <div className="import-source-row">
      <Link size={22} aria-hidden="true" />
      <div><h3>{it.importLinkTitle}</h3><p>{it.importLinkHelp}</p></div>
      <button className="button secondary" disabled={busy} onClick={onLink}>{it.importUrl}</button>
    </div>
    <p className="import-before-confirm">{it.importBeforeConfirm}</p>
    <details className="import-format-help">
      <summary>{it.importFormatsTitle}</summary>
      <p>{it.importFormatsHelp}</p><p>{it.importCatalogHelp}</p>
    </details>
    {onDemo && <aside className="import-demo" aria-labelledby="import-demo-heading">
      <BookOpen size={22} aria-hidden="true" />
      <div><h3 id="import-demo-heading">{it.demoTitle}</h3><p>{it.demoDescription}</p></div>
      <button className="button text-button" disabled={busy} onClick={onDemo}>{it.demoAction}<ArrowRight size={16} aria-hidden="true" /></button>
    </aside>}
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
      <ul>{group.items.slice(0, 100).map((diagnostic, index) => <li key={index} className={diagnostic.severity === 'error' ? 'error-text' : undefined}>
        <p>{diagnostic.message}</p><code>{diagnostic.path}</code>
      </li>)}</ul>
      {group.items.length > 100 && <p className="field-help">{it.displayedDiagnostics}</p>}
    </details>)}
  </div>;
}
