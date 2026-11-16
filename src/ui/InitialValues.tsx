/** @file Beginner-facing score proposals remain local until explicitly applied to the setup draft. */
import { useState } from 'react';
import type { Stat, SystemDefinition } from '../domain/model';
import { abilityIds, assignedScores, pointBuyRemaining, rollAbilityScores, standardScores, supportsAbilitySetup } from '../engine/ability-setup';
import { FieldInput } from './FieldInput';
import { it } from './it';

type Method = 'manual' | 'standard' | 'point' | 'dice';

/** Preserve unknown systems' declared fields; offer D&D methods only for the verified shape. */
export function InitialValues({ system, stats, values, onChange, onPending, automaticHealth = false }: {
  system: SystemDefinition; stats: Stat[]; values: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void; onPending: (pending: boolean) => void;
  automaticHealth?: boolean;
}) {
  const supported = supportsAbilitySetup(system);
  const other = stats.filter(stat => !supported || !abilityIds.some(id => id === stat.id));
  const health = supported ? other.filter(stat => ['base_hp', 'current_hp'].includes(stat.id)) : [];
  const remaining = other.filter(stat => !health.includes(stat));
  return <section className="setup-group"><h3>{it.initialValues}</h3>
    {supported ? <AbilityScores values={values} onChange={onChange} onPending={onPending} />
      : <p className="muted">{it.setupValuesHelp}</p>}
    {health.length > 0 && <section className="setup-health"><h4>{it.setupHealth}</h4>
      <p className="muted">{automaticHealth ? it.setupAutoHpHelp : it.setupHealthHelp}</p>{!automaticHealth && <div className="base-grid">
        {health.map(stat => <div key={stat.id}><FieldInput
          stat={{ ...stat, name: stat.id === 'base_hp' ? it.setupBaseHp : it.setupCurrentHp }}
          value={values[stat.id]} onSave={value => onChange({ [stat.id]: value })} />
          <p className="field-help">{stat.id === 'base_hp' ? it.setupBaseHpHelp : it.setupCurrentHpHelp}</p></div>)}
      </div>}</section>}
    {remaining.length > 0 && <><h4>{it.setupOtherValues}</h4><div className="base-grid">
      {remaining.map(stat => <FieldInput key={stat.id} stat={stat} value={values[stat.id]}
        onSave={value => onChange({ [stat.id]: value })} />)}
    </div></>}
  </section>;
}

/** Method changes never overwrite values; applying a complete proposal is explicit and reversible by Cancel. */
function AbilityScores({ values, onChange, onPending }: {
  values: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void;
  onPending: (pending: boolean) => void;
}) {
  const [method, setMethod] = useState<Method>('manual');
  const [points, setPoints] = useState([8, 8, 8, 8, 8, 8]);
  const [rolls, setRolls] = useState<ReturnType<typeof rollAbilityScores>>([]);
  const [slots, setSlots] = useState(['', '', '', '', '', '']);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState('');
  const pool = method === 'standard' ? standardScores : rolls.map(roll => roll.total);
  const left = pointBuyRemaining(points);
  const complete = method === 'point' ? left >= 0 : pool.length === 6 && new Set(slots).size === 6 && slots.every(Boolean);
  const dirty = () => { setApplied(false); onPending(true); };
  function changeMethod(next: Method) {
    setMethod(next); setApplied(false); setError(''); setSlots(['', '', '', '', '', '']);
    onPending(next !== 'manual');
  }
  function apply() {
    try {
      const scores = method === 'point' ? points : assignedScores(pool, slots);
      if (method === 'point' && pointBuyRemaining(scores) < 0) throw new Error(it.abilityOverBudget);
      onChange(Object.fromEntries(abilityIds.map((id, index) => [id, scores[index]])));
      setApplied(true); onPending(false); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }
  return <div className="ability-setup"><h4>{it.abilityTitle}</h4><p>{it.abilityIntro}</p>
    <label className="field"><span>{it.abilityMethod}</span><select name="ability-method" value={method}
      onChange={event => changeMethod(event.target.value as Method)}>
      <option value="manual">{it.abilityManual}</option><option value="standard">{it.abilityStandard}</option>
      <option value="point">{it.abilityPointBuy}</option><option value="dice">{it.abilityDice}</option>
    </select></label>
    <p className="muted">{method === 'manual' ? it.abilityManualHelp : method === 'standard'
      ? it.abilityStandardHelp : method === 'point' ? it.abilityPointHelp : it.abilityDiceHelp}</p>
    {method === 'dice' && <><button type="button" className="button secondary" onClick={() => {
      try { setRolls(rollAbilityScores()); setSlots(['', '', '', '', '', '']); setError(''); dirty(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    }}>{rolls.length ? it.abilityReroll : it.abilityRoll}</button>
      <p className="field-help">{it.abilityRerollHelp}</p>
      {rolls.length > 0 && <ol className="ability-rolls">{rolls.map((roll, index) => <li key={index}>
        {it.abilityResult} {index + 1}: {roll.dice.map((die, i) => <span key={i}>
          {i === roll.dropped ? <del aria-label={`${die} ${it.abilityDiscarded}`}>{die}</del> : die}{i < 3 ? ' + ' : ' = '}
        </span>)}<strong>{roll.total}</strong>
      </li>)}</ol>}</>}
    {method === 'point' && <p role="status" className={left < 0 ? 'error-text' : 'ability-budget'}>
      {it.abilityRemaining}: <strong>{left} / 27</strong>{left < 0 && ` · ${it.abilityOverBudget}`}</p>}
    <div className="ability-fields">{abilityIds.map((id, index) => <div className="ability-row" key={id}>
      <div><label htmlFor={`setup-${id}`}>{it.abilityNames[index]}</label><p className="field-help">{it.abilityHints[index]}</p></div>
      {method === 'manual' ? <input id={`setup-${id}`} name={id} autoComplete="off" type="number" step="1"
        aria-invalid={typeof values[id] !== 'number' || !Number.isSafeInteger(values[id])}
        required value={typeof values[id] === 'number' ? String(values[id]) : ''}
        onChange={event => onChange({ [id]: event.target.value.trim() ? Number(event.target.value) : NaN })} />
        : method === 'point' ? <select id={`setup-${id}`} name={id} value={points[index]}
          onChange={event => { setPoints(points.map((old, i) => i === index ? Number(event.target.value) : old)); dirty(); }}>
          {[8, 9, 10, 11, 12, 13, 14, 15].map(score => <option value={score} key={score}>{score}</option>)}
        </select> : <select id={`setup-${id}`} name={id} value={slots[index]}
          onChange={event => { setSlots(slots.map((old, i) => i === index ? event.target.value : old)); dirty(); }}>
          <option value="">{it.abilityAssign}</option>{pool.map((score, slot) => <option value={String(slot)} key={slot}
            disabled={slots.some((chosen, i) => i !== index && chosen === String(slot))}>{score} · {it.abilityResult} {slot + 1}</option>)}
        </select>}
    </div>)}</div>
    {method !== 'manual' && <><p className="field-help">{it.abilityApplyHelp}</p>
      <button type="button" className="button secondary" disabled={!complete || applied} onClick={apply}>{it.abilityApply}</button>
      <p role="status">{applied ? it.abilityApplied : it.abilityPending}</p></>}
    {error && <p role="alert" className="error-text">{error}</p>}
    <p className="field-help">{it.abilityBonusHelp}</p>
  </div>;
}
