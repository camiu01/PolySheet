/** @file Accessible shared UI and bounded browser file/download utilities. */
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import type { StoredSystem } from '../domain/model';
import { decodeUtf8 } from '../importing/system';
import { it } from './it';

export type Run = (work: () => Promise<unknown>, success?: string) => Promise<void>;
/** Native modal dialog supplies focus trapping, Escape handling, and focus return. */
export function Modal({ title, children, onClose, bottomSheet = false, wide = false }: { title: string; children: ReactNode; onClose: () => void; bottomSheet?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return createPortal(<dialog ref={ref} className={[bottomSheet ? 'source-bottom-sheet' : '', wide ? 'dialog-wide' : ''].join(' ').trim() || undefined} onCancel={event => { event.preventDefault(); onClose(); }} aria-label={title}>
    <div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label={it.close} onClick={onClose}><X size={20} /></button></div>
    <div className="modal-body">{children}</div>
  </dialog>, document.body);
}
/** Page title and description with an optional trailing action. */
export function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="page-heading"><div><h1>{title}</h1><p className="muted">{description}</p></div>{action}</header>;
}
/** Immutable system version picker; the empty option appears only when no valid selection exists. */
export function SystemSelect({ systems, value, onChange }: { systems: StoredSystem[]; value: string; onChange: (key: string) => void }) {
  return <label className="field system-select"><span>{it.chooseSystem}</span><select value={value} onChange={e => onChange(e.target.value)}>
    {(!systems.length || !value) && <option value="">{it.choose}</option>}
    {systems.map(s => <option key={s.key} value={s.key}>{s.definition.name}{s.definition.id === 'polysheet-sentieri' ? ` · ${it.demoBadge}` : ''} · v{s.definition.version} · {s.digest.slice(0, 6)}</option>)}
  </select></label>;
}
/** Declared compatibility state of a stored system version. */
export function CompatibilityBadge({ system }: { system: StoredSystem }) {
  return <span className={`badge ${system.diagnostics.length ? 'badge-warning' : 'badge-success'}`}>{system.diagnostics.length ? it.partial : it.supported}</span>;
}
/** Warning notice; children carry the real limitation text. */
export function Warning({ children }: { children: ReactNode }) {
  return <div className="notice notice-warning"><AlertTriangle size={18} /><div>{children}</div></div>;
}
/** Empty state; the mark is shown only when a meaningful icon is supplied. */
export function Empty({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return <div className="empty">{icon && <div className="empty-mark" aria-hidden="true">{icon}</div>}<h2>{title}</h2>{children && <p className="muted">{children}</p>}{action}</div>;
}
/** Download local JSON without sending any content to a remote service. */
export function download(text: string, name: string) {
  downloadBlob(new Blob([text], { type: 'application/json' }), name);
}
/** Download an original binary file without recompressing or reserializing it. */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Check the browser's file byte count before materializing its text. */
export async function readFile(file: File, maxBytes: number) {
  if (file.size > maxBytes) throw new Error(`File troppo grande: massimo ${maxBytes / 1024 / 1024} MB.`);
  return decodeUtf8(await file.arrayBuffer());
}
