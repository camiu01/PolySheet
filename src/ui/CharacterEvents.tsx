/** @file Character-only events with fresh snapshots, persisted overrides and explicit popup saves. */
import { useRef, useState } from 'react';
import { characterEventPlan } from '../engine/character-events';
import type { Character, StoredSystem } from '../domain/model';
import { RuntimeResource } from '../engine/formulas';
import { resolveCharacterOverrides } from '../engine/overrides';
import { RenderView, type RenderContext } from './renderer';
import { Modal } from './shared';
import { it } from './it';
import { SourceForm } from './SourceForm';
import { runCharacterEvent, saveCharacterEvent } from '../persistence/character-events';
import { canSourceEvent } from './view-support';

export { canSourceEvent };

/** An unsupported event keeps its visible marker and cannot be executed. */
export function SourceEventButton({ context, event, label }: { context: RenderContext; event: unknown; label: string }) {
  return canSourceEvent(context, event)
    ? <button type="button" className="button secondary" disabled={context.eventBusy}
        onClick={() => context.onEvent?.(event)}>{label}</button>
    : <p className="unsupported-note">{label} · {it.unsupportedEvent}</p>;
}

function MessageList({ messages }: { messages: { text: string; type: string }[] }) {
  return <>{messages.map((message, index) => <p key={index} role={message.type === 'error' ? 'alert' : undefined}
    className={message.type === 'error' ? 'error-text' : undefined}>{message.text}</p>)}</>;
}

/** Serialize commands and retain the opening source event for popup saves; never roll during rendering or restore. */
export function useCharacterEvents(system: StoredSystem, character: Character) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [display, setDisplay] = useState<Awaited<ReturnType<typeof runCharacterEvent>> & { event: unknown }>();
  const [error, setError] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const canEvent = (event: unknown) => {
    try { characterEventPlan(system.definition, event); return true; } catch { return false; }
  };
  function onEvent(event: unknown) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    void runCharacterEvent(character.id, event).then(snapshot => setDisplay({ ...snapshot, event }))
      .catch(cause => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => { lock.current = false; setBusy(false); });
  }
  const result = display?.result;
  const resolved = result ? resolveCharacterOverrides(result.overrides) : undefined;
  const context: RenderContext | undefined = display && result && resolved ? {
    stats: display.system.definition.character_stats, values: display.character.values,
    overrides: resolved.values, modifiers: resolved.modifiers,
    resources: display.resources, resourceDefinitions: display.system.definition.resources,
    enumerations: display.system.definition.enumerated_types, systemKey: display.system.key,
    createdAt: display.character.createdAt,
    character: new RuntimeResource(`character:${display.character.id}`, display.system.definition.character_stats,
      display.character.values, display.character.createdAt, {}, resolved.values, undefined, resolved.modifiers),
    variables: result.kind === 'popup' ? result.variables : { $edit_mode: false },
    onCommit: result.kind === 'popup' && result.edit ? async patch => {
      if (typeof patch === 'function') throw new Error(it.invalidValue);
      await saveCharacterEvent(display.character.id, display.event, result.edit!.field, patch);
    } : undefined
  } : undefined;
  const dialog = error ? <Modal title={it.eventFailed} onClose={() => setError('')}><p role="alert">{error}</p></Modal>
    : result && context && <Modal
      title={result.kind === 'roll' ? it.eventRollResults : result.kind === 'popup' ? result.title : it.eventApplied}
      onClose={() => !formBusy && setDisplay(undefined)}>
      {result.kind === 'popup' ? result.edit
        ? <SourceForm input={result.input} context={context} onBusyChange={setFormBusy} onDone={() => setDisplay(undefined)} />
        : <RenderView input={result.input} context={context} />
        : <>
          {result.messages.length > 0 ? <MessageList messages={result.messages} /> : result.kind === 'effects'
            ? <p className="muted">{it.eventAppliedHelp}</p> : <p className="muted">{it.eventRollHelp}</p>}
          {result.reverted.length > 0 && <p className="muted">{it.eventReverted} {result.reverted.join(', ')}</p>}
          {result.kind === 'roll' && result.rolls.map((row, index) => <section key={index}>
            <h3>{row.text}</h3>{row.results.map((roll, i) => <p key={i}>{roll.expression}: {roll.dice.join(', ')} → <strong>{roll.total}</strong></p>)}
            <p>{it.eventTotal}: <strong>{row.results.reduce((sum, roll) => sum + roll.total, 0)}</strong></p>
          </section>)}
        </>}
    </Modal>;
  return { canEvent, onEvent, eventBusy: busy, dialog };
}
