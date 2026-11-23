/**
 * @file Source-driven, text-only view rendering with explicit unsupported markers.
 * @remarks Sheet inputs commit on blur; source forms own explicit `$view` drafts.
 */
import { Component, useEffect, useId, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { createEvaluator, type EvaluationEnvironment } from '../engine/formulas';
import { formula, object, view, type Stat, type View } from '../domain/model';
import { unsupportedViewOptions, viewFields } from '../importing/system';
import { ViewError } from './ViewErrors';
import { it } from './it';
import { PhotoInput } from './PhotoInput';
import { inputValue, readableOn, saveInput, sourceColor, sourceIcons, textValue, viewColor } from './view-support';
import { SourcePopup, SourceResourceSelect, SourceResourceSection, DeferredResourceSelect } from './SourceViews';
import { BalancedGrid, SourceCollapsible, SourceViewPager } from './SourceLayoutViews';
import { SourceButton, SourceMenuButton, SourceSelect, SourceTicker } from './SourceValueViews';
import { Markdown } from './Markdown';
import { SourceResourceArray, SourceResourceView } from './SourceResourceViews';
import type { ValuePatch } from '../persistence/views';
import type { ResourceInstance } from '../domain/model';
import { SourceStat } from './SourceStat';
import { canSourceEvent, SourceEventButton } from './CharacterEvents';

export { textValue, sourceColor };


export interface RenderContext extends EvaluationEnvironment {
  /** Explicit character-only presentation commands; absent from resources/combat and draft sessions. */
  canEvent?: (event: unknown) => boolean;
  onEvent?: (event: unknown) => void;
  eventBusy?: boolean;
  /** Set on a resource card whose `canEvent`/`onEvent` target that resource's own mechanics. */
  eventScope?: 'resource';
  /** Sheet-level gates handed down so nested resource cards can build their own event scope. */
  canResourceEvent?: (definitionId: string, event: unknown) => boolean;
  onResourceEvent?: (resourceId: string, event: unknown, view?: Record<string, unknown>) => void;
  /** Sheet-owned unsaved card choices by resource id, read by that card's buttons as `$view`. */
  cardInputs?: Map<string, Record<string, unknown>>;
  /** Set on a resource card: record one unsaved local choice (a `select` on a calculated stat). */
  onCardInput?: (viewId: string, value: unknown) => void;
  /** Persist a base input on the owning resource card, using the sheet's save/error status. */
  onResourceChange?: (resourceId: string, statId: string, value: unknown) => void;
  onResourceOverride?: (resourceId: string, statId: string, value: number) => void;
  /** Set on a resource card: writes a calculated value of that instance (source ticker on charges). */
  onOverride?: (statId: string, value: number) => void;
  stats: Stat[];
  values: Record<string, unknown>;
  onChange?: (id: string, value: unknown) => void;
  systemKey?: string;
  onCommit?: (patch: ValuePatch, additions?: ResourceInstance[]) => Promise<void>;
  drafts?: Record<string, unknown>;
  validationErrors?: Record<string, string>;
  /** The owning form announces errors in one summary, so field messages are not live regions. */
  validationSummary?: boolean;
  /** Source validation messages stay hidden until the user first tries to continue. */
  hideValidation?: boolean;
  onInput?: (viewId: string, statId: string, value: unknown) => void;
  previewValues?: Record<string, unknown>;
  /** Ids of resources that exist only in an enclosing draft; edits replace the staged copy. */
  stagedIds?: string[];
  /** Raw `enumerated_types`; used by select and menu options only. */
  enumerations?: unknown[];
}
/** Edit one supported scalar. Invalid numeric drafts never reach persistence. */
export function ScalarInput({ stat, value, onSave, onDraft, label, min, max, maxLength, hint, step }: {
  stat: Stat; value: unknown; onSave: (v: string | number | boolean) => void;
  label?: string; min?: number; max?: number; maxLength?: number; hint?: string; step?: number;
  onDraft?: (v: string | number) => void;
}) {
  const [draft, setDraft] = useState(String(value ?? ''));
  const [error, setError] = useState('');
  const caption = label ?? stat.name;
  function change(text: string) {
    setDraft(text);
    // Flag an out-of-range draft at once: a form can submit drafts before this input blurs.
    const number = Number(text);
    if (stat.value_type !== 'string') setError(text.trim() && Number.isFinite(number)
      && (min !== undefined && number < min || max !== undefined && number > max) ? it.invalidNumber : '');
    if (onDraft) onDraft(stat.value_type === 'string' ? text : text.trim() ? Number(text) : NaN);
  }
  if (stat.value_type === 'bool') return <label className="check-field">
    <input type="checkbox" checked={value === true} onChange={e => onSave(e.target.checked)} />{caption}
  </label>;
  function commit() {
    const numeric = ['integer', 'decimal'].includes(stat.value_type);
    const next = numeric ? Number(draft) : draft;
    if (numeric && (!draft.trim() || !Number.isFinite(next) || (stat.value_type === 'integer' && !Number.isSafeInteger(next)) ||
      (min !== undefined && Number(next) < min) || (max !== undefined && Number(next) > max))) {
      setError(it.invalidNumber); return;
    }
    setError('');
    if (next !== value) onSave(next);
  }
  return <label className="field">
    <span>{caption}</span>
    {stat.value_type === 'string'
      ? <textarea aria-label={caption} aria-invalid={!!error} value={draft} maxLength={maxLength ?? 10000} placeholder={hint} rows={maxLength && maxLength <= 100 ? 1 : 3}
          onChange={e => change(e.target.value)} onBlur={commit} />
      : <input aria-label={caption} aria-invalid={!!error} type="number" step={step ?? (stat.value_type === 'integer' ? 1 : 'any')}
          min={min} max={max} value={draft} onChange={e => change(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />}
    {error && <small role="alert" className="error-text">{error}</small>}
  </label>;
}
type Renderer = (v: View, ctx: RenderContext, evaluate: (v: unknown) => unknown) => ReactNode;
function children(items: unknown, ctx: RenderContext) {
  if (!Array.isArray(items)) throw new Error(it.viewInvalidList);
  // Index-qualified keys: official sources repeat ids on static siblings.
  return items.map((v, i) => <RenderView key={`${String(object(v).id ?? '')}:${i}`} input={v} context={ctx} />);
}
function resourceText(v: View, ctx: RenderContext) {
  if (v.resource_id == null) return undefined;
  const d = ctx.resourceDefinitions?.find(d => d.id === v.resource_id);
  if (!d || typeof v.resource_instance_ids_stat !== 'string') throw new Error(it.noResourceType);
  const value = createEvaluator(ctx.stats, ctx.values, undefined, ctx).get(v.resource_instance_ids_stat);
  // A source list may name identities the character does not own (5e `spell.classes` lists every
  // class able to cast it, and `source` names a book). Only resolvable instances are shown.
  return (Array.isArray(value) ? value : [value]).filter(id => id != null).flatMap(id => {
    const eligible = (r: ResourceInstance) => r.definitionId === d.id && (!ctx.systemKey || r.systemKey === ctx.systemKey);
    // Upstream identity strings (5e `spell.classes`: "bard") survive a private copy as text.
    const local = ctx.resources?.find(r => r.id === id);
    const r = local && eligible(local) ? local
      : local ? undefined
      : ctx.resources?.find(r => eligible(r) && (r.sourceId === id || r.values.id === id));
    // A local id that exists under another pin or type is a real mismatch; an unknown identity is not owned.
    if (!r && local) throw new Error(it.missingResource);
    if (!r) return [];
    const display = typeof v.resource_display_stat === 'string' ? v.resource_display_stat : d.display_name;
    const label = display ? textValue(createEvaluator(d.stats, r.values, undefined, { resources: ctx.resources, resourceDefinitions: ctx.resourceDefinitions, createdAt: r.createdAt, instanceId: r.sourceId ?? r.id, enumerations: ctx.enumerations, character: ctx.character }).get(display)) : r.name;
    return label ? [label] : [];
  }).join(', ');
}
const sourceIconEntries = Object.entries(sourceIcons);
function size(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(800, Math.max(0, value)) : fallback;
}
function align(value: unknown): 'flex-start' | 'center' | 'flex-end' {
  return value === 'end' ? 'flex-end' : value === 'center' ? 'center' : 'flex-start';
}
/** Extensible view registry. Unknown types produce a marker, not an invented UI. */
export const rendererRegistry = new Map<string, Renderer>([
  ['icon', (v, _ctx, e) => {
    const entry = sourceIconEntries.find(([name]) => name === v.name);
    if (!entry) throw new Error(`${it.unsupported}: ${String(v.name)}`);
    const Icon = entry[1];
    return <Icon aria-hidden="true" size={v.size === 'small' ? 18 : v.size === 'large' ? 32 : 24} color={viewColor(v.color, e)} />;
  }],
  ['collapsible', (v, ctx, e) => <SourceCollapsible node={v} context={ctx} evaluate={e} />],
  ['viewPager', (v, ctx, e) => <SourceViewPager node={v} context={ctx} evaluate={e} />],
  ['ticker', (v, ctx, e) => <SourceTicker node={v} context={ctx} evaluate={e} />],
  ['button', (v, ctx, e) => <SourceButton node={v} context={ctx} evaluate={e} />],
  ['select', (v, ctx, e) => <SourceSelect node={v} context={ctx} evaluate={e} />],
  ['menuButton', (v, ctx, e) => <SourceMenuButton node={v} context={ctx} evaluate={e} />],
  ['resource', (v, ctx) => <SourceResourceView node={v} context={ctx} />],
  ['resourceArray', (v, ctx) => <SourceResourceArray node={v} context={ctx} />],
  ['avatarSection', (v, ctx, e) => <section className="source-avatar-section">
    <div className="source-avatar-center">{children(v.center_content, ctx)}</div>
    <div className="source-avatar-stacks"><div>{children(v.bottom_left_stack ?? [], ctx)}</div><div>{children(v.bottom_right_stack ?? [], ctx)}</div></div>
    {['left', 'right'].map(side => v[`bottom_${side}_button_title`] != null && <SourceEventButton key={side}
      context={ctx} event={v[`bottom_${side}_button_event`]} label={textValue(e(v[`bottom_${side}_button_title`]))} />)}
  </section>],
  ['popUpButton', (v, ctx) => <SourcePopup node={v} context={ctx} />],
  ['selectResources', (v, ctx) => !ctx.drafts && v.should_save_on_selection !== true ? <DeferredResourceSelect node={v} context={ctx} /> : <SourceResourceSelect node={v} context={ctx} />],
  ['resourceSection', (v, ctx) => <SourceResourceSection node={v} context={ctx} />],
  ['chip', (v, ctx, e) => {
    const background = viewColor(v.background_color, e), style = { backgroundColor: background, color: readableOn(background), borderColor: viewColor(v.border_color, e) };
    const className = `source-chip ${v.style === 'compact' ? 'source-chip-compact' : ''}`, label = resourceText(v, ctx) ?? (v.text ? textValue(e(v.text)) : '');
    // A tapped chip runs its character event; without one it stays a label.
    return canSourceEvent(ctx, v.on_tap_event)
      ? <button type="button" className={className} style={style} disabled={ctx.eventBusy} onClick={() => ctx.onEvent!(v.on_tap_event)}>{label}</button>
      : <span className={className} style={style}>{label}</span>;
  }],
  ['listItem', (v, ctx, e) => {
    // `chips` computes to the literal chip views built by `createChip`; anything else is rejected by the view schema.
    const chips = v.chips == null ? [] : e(v.chips);
    if (!Array.isArray(chips) || chips.length > 50) throw new Error('chips richiede una lista di al massimo 50 chip');
    return <div className="source-list-item">
      <div><strong style={{ color: viewColor(v.title_color, e) }}>{v.title ? textValue(e(v.title)) : ''}</strong>
        <span style={{ color: viewColor(v.first_line_extra_color, e) }}>{v.first_line_extra ? textValue(e(v.first_line_extra)) : ''}</span></div>
      <div><p style={{ color: viewColor(v.subtitle_color, e) }}>{v.subtitle ? textValue(e(v.subtitle)) : ''}</p>
        <span style={{ color: viewColor(v.second_line_extra_color, e) }}>{v.second_line_extra ? textValue(e(v.second_line_extra)) : ''}</span></div>
      {chips.length > 0 && <div className="source-list-chips">{chips.map((chip, i) => {
        if (object(chip).type !== 'chip') throw new Error('chips accetta solo viste chip');
        return <RenderView key={String(object(chip).id ?? i)} input={chip} context={ctx} />;
      })}</div>}
    </div>;
  }],
  ['text', (v, ctx, e) => {
    if (typeof v.edit_stat === 'string') {
      const stat = ctx.stats.find(s => s.id === v.edit_stat);
      if (!stat || !['string', 'integer', 'decimal', 'bool'].includes(stat.value_type)) throw new Error(it.viewNotEditable);
      // A calculated target cannot store input; show its current value read-only (5e `selected_options`).
      if (stat.type !== 'base') return <span className="text-view">{textValue(e({ type: 'stat', stat: stat.id }))}</span>;
      if (ctx.onChange) return <ScalarInput key={ctx.drafts ? v.id : `${stat.id}:${String(ctx.values[stat.id])}`} stat={stat}
        value={inputValue(v, ctx, stat)}
        label={v.label ? textValue(e(v.label)) : stat.name}
        hint={v.hint ? textValue(e(v.hint)) : undefined}
        maxLength={typeof v.max_length === 'number' ? Math.min(10000, Math.max(1, v.max_length)) : undefined}
        onDraft={ctx.onInput ? value => saveInput(v, ctx, stat.id, value) : undefined}
        onSave={value => saveInput(v, ctx, stat.id, value)} />;
    }
    const value = resourceText(v, ctx) ?? (v.text ? e(v.text) : '');
    if (v.markdown === true) return <Markdown text={textValue(value)} className={`view-text view-text-${String(v.style ?? 'text')}`} />;
    return <p className={`view-text view-text-${String(v.style ?? 'text')}`} style={{ fontWeight: v.bold === true ? 700 : undefined, color: viewColor(v.color, e),
      ...(typeof v.max_lines === 'number' && v.max_lines > 0 ? { display: '-webkit-box', WebkitLineClamp: Math.min(100, Math.floor(v.max_lines)), WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {})
    }}>{typeof value === 'number' && v.signed === true && value >= 0 ? `+${value}` : textValue(value)}</p>;
  }],
  ['stat', (v, ctx, e) => <SourceStat node={v} context={ctx} evaluate={e} />],
  ['avatar', (v, ctx, e) => {
    if (typeof v.name_stat !== 'string') throw new Error('avatar richiede name_stat');
    const name = textValue(e({ type: 'stat', stat: v.name_stat }));
    const photo = typeof v.photo_stat === 'string' ? e({ type: 'stat', stat: v.photo_stat }) : null;
    const editable = ctx.stats.find(s => s.id === v.photo_stat && s.type === 'base' && s.value_type === 'photo');
    return <PhotoInput label={name || it.choosePhoto} value={photo} preview={v.preview_enabled === true}
      size={typeof v.size === 'string' ? v.size : 'medium'}
      onSave={v.interactable === true && editable && ctx.onChange ? value => ctx.onChange?.(editable.id, value) : undefined} />;
  }],
  ['section', (v, ctx) => {
    const header = <div className={`section-heading ${v.show_divider === false ? 'no-divider' : ''}`}>{children(v.header, ctx)}</div>;
    const content = <BalancedGrid minWidth={v.content_item_min_width} justifyItems={align(v.alignment ?? 'center')}>{children(v.content, ctx)}</BalancedGrid>;
    return v.collapsible === true
      ? <details className={`sheet-section ${v.always_show_collapse_icon !== true ? 'collapse-icon-closed-only' : ''}`} open={v.start_collapsed !== true}><summary>{header}</summary>{content}</details>
      : <section className="sheet-section">{header}{content}</section>;
  }],
  ['list', (v, ctx) => <div className="view-list" style={{ padding: size(v.padding), paddingTop: v.padding_top == null ? undefined : size(v.padding_top), paddingRight: v.padding_right == null ? undefined : size(v.padding_right), paddingBottom: v.padding_bottom == null ? undefined : size(v.padding_bottom), paddingLeft: v.padding_left == null ? undefined : size(v.padding_left), alignItems: align(v.alignment) }}>{children(v.subviews, ctx)}</div>],
  ['composite', (v, ctx) => <div className="view-composite" style={{ justifyContent: align(v.alignment), flexWrap: v.row_only === true ? 'nowrap' : 'wrap' }}>{children(v.subviews, ctx)}</div>],
  ['divider', () => <hr />], ['spacer', () => <span className="spacer" />],
  ['checkbox', (v, ctx, e) => {
    const stat = ctx.stats.find(s => s.id === v.stat && s.type === 'base' && s.value_type === 'bool');
    if (!stat) throw new Error(it.viewCheckboxStat);
    // `switcher` is the same boolean input presented as an accessible switch.
    return <><label className={`check-field ${v.label_alignment === 'left' ? 'check-label-left' : ''} ${v.style === 'switcher' ? 'switch-field' : ''}`}><input type="checkbox" role={v.style === 'switcher' ? 'switch' : undefined} checked={inputValue(v, ctx, stat) === true}
      disabled={!ctx.onChange || (v.enabled != null && e(v.enabled) !== true)}
      onChange={event => saveInput(v, ctx, stat.id, event.target.checked)} />{v.label ? textValue(e(v.label)) : stat.name}</label>
      {ctx.onChange && !ctx.drafts && v.should_auto_save !== true && <small className="unsupported-note">{it.explicitSave}</small>}</>;
  }]
]);
interface ViewProps { input: unknown; context: RenderContext }
/** Catch deferred React child failures too; retry when inputs or their snapshot change. */
class ViewErrorBoundary extends Component<ViewProps & { children: ReactNode }, ViewProps & { error: string | null }> {
  state: ViewProps & { error: string | null } = { input: this.props.input, context: this.props.context, error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  static getDerivedStateFromProps(props: ViewProps, state: ViewProps) {
    return props.input !== state.input || props.context !== state.context
      ? { input: props.input, context: props.context, error: null } : null;
  }
  render() {
    return this.state.error !== null
      ? <ViewError message={this.state.error} title={it.viewUnavailable} />
      : this.props.children;
  }
}
/** Safely render one node and its React descendants; failures stay local and visible. */
export function RenderView(props: ViewProps) {
  return <ViewErrorBoundary input={props.input} context={props.context}><ViewContent {...props} /></ViewErrorBoundary>;
}
const editableControls = 'input:not([type=hidden]), select, textarea, [role=combobox], [role=listbox]';

/**
 * Mark the editable controls of a view with its validation message: `aria-invalid` plus
 * `aria-describedby`, added and removed with the message. Source views build arbitrary
 * control trees, so the controls are found in the rendered wrapper rather than threaded through.
 */
function useFieldValidation(message: string | undefined) {
  const wrapper = useRef<HTMLDivElement>(null), id = useId();
  useEffect(() => {
    const controls = message ? [...wrapper.current?.querySelectorAll<HTMLElement>(editableControls) ?? []] : [];
    for (const control of controls) {
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', [control.getAttribute('aria-describedby'), id].filter(Boolean).join(' '));
    }
    return () => {
      for (const control of controls) {
        control.removeAttribute('aria-invalid');
        const rest = (control.getAttribute('aria-describedby') ?? '').split(' ').filter(token => token && token !== id);
        if (rest.length) control.setAttribute('aria-describedby', rest.join(' ')); else control.removeAttribute('aria-describedby');
      }
    };
  }, [message, id]);
  return { wrapper, id };
}

function ViewContent({ input, context }: ViewProps) {
  // `$edit_mode` is true only inside a real draft session, never during sheet rendering.
  const environment: RenderContext = { ...context, variables: { $edit_mode: context.drafts !== undefined, ...context.variables } };
  const viewId = input && typeof input === 'object' && !Array.isArray(input) ? (input as { id?: unknown }).id : undefined;
  const message = !context.hideValidation && typeof viewId === 'string' ? context.validationErrors?.[viewId] : undefined;
  const validation = useFieldValidation(message);
  try {
    const v = view(input);
    const options = unsupportedViewOptions(v);
    if (options.length) throw new Error(`${it.unsupported}: ${options.join(', ')}`);
    let evaluator: ReturnType<typeof createEvaluator> | undefined;
    const e = (value: unknown) => {
      evaluator ??= createEvaluator(environment.stats, environment.values, undefined, environment);
      return evaluator.evaluate(value);
    };
    if (v.is_visible != null) {
      const visible = e(formula(v.is_visible));
      if (typeof visible !== 'boolean') throw new Error('is_visible deve restituire bool');
      if (!visible) return null;
    }
    const handler = rendererRegistry.get(v.type);
    if (!handler) return <div className="unsupported"><strong>{it.unsupported}: {v.type}</strong><small>{v.id}</small></div>;
    if (v.validation_message != null && !context.drafts && context.onChange)
      return <DeferredResourceSelect node={v} context={environment} />;
    const eventKeys = v.type === 'stat' ? ['on_tap_event', 'on_long_tap_event']
      : v.type === 'chip' ? ['on_tap_event']
      : v.type === 'avatarSection' ? ['bottom_left_button_event', 'bottom_right_button_event'] : [];
    const ignored = Object.keys(v).filter(k => v[k] != null
      && !(eventKeys.includes(k) && canSourceEvent(environment, v[k]))
      && !['id', 'type', 'is_visible', 'validation_message', 'margin_left', 'margin_right', 'margin_top', 'margin_bottom', ...viewFields[v.type]].includes(k));
    const style: CSSProperties = {
      marginLeft: size(v.margin_left), marginRight: size(v.margin_right),
      marginTop: size(v.margin_top), marginBottom: size(v.margin_bottom)
    };
    // Each message is tied to its controls; with a form summary it is not another alert.
    return <div className="view-wrapper" style={style} ref={validation.wrapper}>
      {handler(v, environment, e)}
      {message && <p id={validation.id} role={context.validationSummary ? undefined : 'alert'} className="error-text field-error">{message}</p>}
      {v.validation_message != null && !context.drafts && <small className="unsupported-note">{it.validationRequiresForm}</small>}
      {ignored.length > 0 && <small className="unsupported-note">{it.unsupported}: {ignored.join(', ')}</small>}
    </div>;
  } catch (error) {
    return <ViewError message={error instanceof Error ? error.message : String(error)} />;
  }
}
