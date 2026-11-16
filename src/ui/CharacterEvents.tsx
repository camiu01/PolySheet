/** @file Character-only events with fresh snapshots and explicitly saved direct-field popup drafts. */
import { useRef, useState } from 'react';
import { characterEventEffect, executeCharacterEvent } from '../engine/character-events';
import type { Character, StoredSystem } from '../domain/model';
import { db } from '../persistence/db';
import { RuntimeResource } from '../engine/formulas';
import { RenderView, type RenderContext } from './renderer';
import { Modal } from './shared';
import { it } from './it';
import { SourceForm } from './SourceForm';
import { saveCharacterEvent } from '../persistence/character-events';

/** Events are not implicitly forwarded from nested resources, combat or draft sessions to their owner. */
export function canSourceEvent(context: RenderContext, event: unknown) {
  return event != null && !context.drafts && context.stats === context.character?.stats
    && context.canEvent?.(event) === true && !!context.onEvent;
}

/** An unsupported event keeps its visible marker and cannot be executed. */
export function SourceEventButton({ context, event, label }: { context: RenderContext; event: unknown; label: string }) {
  return canSourceEvent(context, event)
    ? <button type="button" className="button secondary" disabled={context.eventBusy}
        onClick={() => context.onEvent?.(event)}>{label}</button>
    : <p className="unsupported-note">{label} · {it.unsupportedEvent}</p>;
}

/** Serialize commands locally and never roll during rendering, popup reopening or offline restore. */
export function useCharacterEvents(system: StoredSystem, character: Character) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [display, setDisplay] = useState<{ result: ReturnType<typeof executeCharacterEvent>; context: RenderContext }>();
  const [error, setError] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const canEvent = (event: unknown) => {
    try { characterEventEffect(system.definition, event); return true; } catch { return false; }
  };
  function onEvent(event: unknown) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    void db.transaction('r', db.characters, db.systems, db.resources, async () => {
      const owner = await db.characters.get(character.id), latest = await db.systems.get(system.key);
      if (!owner || !latest || owner.systemKey !== latest.key) throw new Error(it.eventOwnerMissing);
      const resources = await db.resources.where('systemKey').equals(latest.key).toArray();
      const result = executeCharacterEvent(latest, owner, resources, event);
      const context: RenderContext = { stats: latest.definition.character_stats, values: owner.values, resources,
        resourceDefinitions: latest.definition.resources, enumerations: latest.definition.enumerated_types,
        systemKey: latest.key, createdAt: owner.createdAt,
        character: new RuntimeResource(`character:${owner.id}`, latest.definition.character_stats, owner.values, owner.createdAt),
        variables: result.kind === 'popup' ? result.variables : { $edit_mode: false },
        onCommit: result.kind === 'popup' && result.edit ? async patch => {
          if (typeof patch === 'function') throw new Error(it.invalidValue);
          await saveCharacterEvent(owner.id, event, result.edit!.field, patch);
        } : undefined };
      return { result, context };
    }).then(setDisplay).catch(cause => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => { lock.current = false; setBusy(false); });
  }
  const dialog = error ? <Modal title={it.eventFailed} onClose={() => setError('')}><p role="alert">{error}</p></Modal>
    : display && <Modal title={display.result.kind === 'roll' ? it.eventRollResults : display.result.title} onClose={() => !formBusy && setDisplay(undefined)}>
      {display.result.kind === 'popup' ? display.result.edit
        ? <SourceForm input={display.result.input} context={display.context} onBusyChange={setFormBusy} onDone={() => setDisplay(undefined)} />
        : <RenderView input={display.result.input} context={display.context} />
        : <><p className="muted">{it.eventRollHelp}</p>{display.result.rolls.map((row, index) => <section key={index}>
          <h3>{row.text}</h3>{row.results.map((roll, i) => <p key={i}>{roll.expression}: {roll.dice.join(', ')} → <strong>{roll.total}</strong></p>)}
          <p>{it.eventTotal}: <strong>{row.results.reduce((sum, roll) => sum + roll.total, 0)}</strong></p>
        </section>)}</>}
    </Modal>;
  return { canEvent, onEvent, eventBusy: busy, dialog };
}
