/**
 * @file Shared, React-free helpers for source view rendering.
 * @remarks Colours and identifiers accept only documented palette names, bounded
 * hex literals and validated resource links.
 */
import { BookOpen, Shield, Backpack, Swords, Flag, Dices, Skull, Sparkles, Star, Pencil, MoreHorizontal, MoreVertical, Sun, PawPrint, ArrowUp, ArrowUpDown, Flame, Badge, Circle } from 'lucide-react';
import { isResourceReference, type Stat, type View } from '../domain/model';
import { it } from './it';
import { RuntimeResource } from '../engine/formulas';

/** Minimal rendering state needed to read and stage one source input. */
export interface InputContext {
	values: Record<string, unknown>;
	drafts?: Record<string, unknown>;
	overrides?: Record<string, unknown>;
	modifiers?: Record<string, unknown>;
	onChange?: (id: string, value: unknown) => void;
	onInput?: (viewId: string, statId: string, value: unknown) => void;
}

/** Event gate shared by source controls: the character sheet, or a resource card with its own scope. */
export function canSourceEvent(context: {
	drafts?: Record<string, unknown>;
	stats: Stat[];
	character?: { stats: Stat[] };
	eventScope?: 'resource';
	canEvent?: (event: unknown) => boolean;
	onEvent?: (event: unknown) => void;
}, event: unknown) {
	return event != null && !context.drafts && (context.stats === context.character?.stats || context.eventScope === 'resource')
		&& context.canEvent?.(event) === true && !!context.onEvent;
}


/**
 * Event scope of one resource card: its buttons run that resource's own mechanics.
 * Catalog originals and draft sessions never dispatch.
 * Base inputs use the sheet's resource writer, never its character writer.
 */
export function resourceEventScope(context: {
	drafts?: Record<string, unknown>; eventBusy?: boolean;
	canResourceEvent?: (definitionId: string, event: unknown) => boolean;
	onResourceEvent?: (resourceId: string, event: unknown) => void;
	onResourceChange?: (resourceId: string, statId: string, value: unknown) => void;
	onResourceOverride?: (resourceId: string, statId: string, value: number) => void;
}, record: { id: string; definitionId: string; catalogSource?: unknown }) {
	const { canResourceEvent, onResourceEvent, onResourceOverride, onResourceChange } = context;
	if (!canResourceEvent || !onResourceEvent || context.drafts !== undefined || record.catalogSource) return {};
	return {
		eventScope: 'resource' as const, eventBusy: context.eventBusy, canResourceEvent, onResourceEvent, onResourceOverride, onResourceChange,
		onChange: onResourceChange && ((statId: string, value: unknown) => onResourceChange(record.id, statId, value)),
		onOverride: onResourceOverride && ((statId: string, value: number) => onResourceOverride(record.id, statId, value)),
		canEvent: (event: unknown) => canResourceEvent(record.definitionId, event),
		onEvent: (event: unknown) => onResourceEvent(record.id, event)
	};
}

/** Explicit source icon names mapped to local glyphs; artwork is not copied. */
export const sourceIcons: Record<string, typeof Shield> = {
	ic_armor: Shield, ic_backpack: Backpack, ic_battle: Swords, ic_campaign_banner: Flag, ic_d20: Dices,
	ic_death: Skull, ic_skills: Sparkles, ic_star: Star, ic_weapon: Swords, ic_badge: Badge,
	ic_conditions: Circle, ic_daytime: Sun, ic_edit: Pencil, ic_more_horiz: MoreHorizontal,
	ic_more_vert: MoreVertical, ic_notes: BookOpen, ic_pets: PawPrint, ic_progression: ArrowUp,
	ic_sort: ArrowUpDown, ic_stars: Sparkles, ic_whatshot: Flame
};

/** Render a scalar source value as text; complex values are never coerced. */
export function textValue(value: unknown) {
	if (value === null || value === undefined) return '';
	if (typeof value === 'object') throw new Error('Valore complesso non visualizzabile come testo');
	return String(value);
}

/** CSS accepts only documented colours or bounded hexadecimal literals. */
export function sourceColor(value: unknown): string | undefined {
	if (value == null) return undefined;
	const colors: Record<string, string> = {
		accent: 'var(--accent)', primary: 'var(--accent)', primaryDark: 'var(--accent)',
		text: 'var(--ink)', hint: 'var(--muted)', buttonSurface: 'var(--surface-soft)'
	};
	if (typeof value === 'string' && Object.hasOwn(colors, value)) return colors[value];
	if (typeof value === 'string' && /^#(?:[a-f\d]{3}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value)) return value;
	throw new Error(it.invalidColor);
}

/**
 * Pick a legible foreground for a literal hex background.
 * @returns Near-black or white by relative luminance, or undefined for palette variables that already pair with the theme ink.
 */
export function readableOn(background: string | undefined): string | undefined {
	const hex = background?.match(/^#([a-f\d]{3}|[a-f\d]{6}|[a-f\d]{8})$/i)?.[1];
	if (!hex) return undefined;
	const full = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex;
	const [r, g, b] = [0, 2, 4].map(i => {
		const channel = parseInt(full.slice(i, i + 2), 16) / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#111417' : '#ffffff';
}

/** View colours are either literal palette values or formulas returning one. */
export function viewColor(value: unknown, evaluate: (input: unknown) => unknown): string | undefined {
	if (value == null) return undefined;
	return sourceColor(typeof value === 'string' ? value : evaluate(value));
}

/**
 * Read a resource instance id from a reference object or a stored string id.
 * @returns The id, or undefined when the value is not a resource reference.
 */export function resourceReferenceId(value: unknown): string | undefined {
	if (isResourceReference(value)) return value.resourceId;
	// Calculated resource stats evaluate to runtime scopes keyed by their local id.
	if (value instanceof RuntimeResource) return value.key.startsWith('resource:') ? value.key.slice('resource:'.length) : undefined;
	if (typeof value === 'string' && value.length > 0 && value.length <= 500) return value;
	if (Array.isArray(value) && value.length === 1) return resourceReferenceId(value[0]);
	return undefined;
}

/** Read every resource id from a scalar, reference or reference array value. */
export function resourceReferenceIds(value: unknown): string[] {
	const items = Array.isArray(value) ? value : [value];
	return items.map(resourceReferenceId).filter((id): id is string => id !== undefined);
}

/**
 * CSS grid tracks for a source `content_item_min_width`.
 * @remarks A fraction up to 1 is a share of the row, so 0.5 always yields two
 * columns; larger values are pixel minimums that wrap to the available width.
 */
export function gridColumns(value: unknown): string {
	const width = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 160;
	if (width <= 1) return `repeat(${Math.min(12, Math.max(1, Math.floor(1 / width + 1e-9)))},minmax(0,1fr))`;
	return `repeat(auto-fit,minmax(min(100%,${Math.min(800, width)}px),1fr))`;
}

/** Readable fallback for a source identifier shown where the source gives no title. */
export function readableId(id: string): string {
	const text = id.replace(/[_-]+/g, ' ').trim();
	return text ? text.charAt(0).toLocaleUpperCase('it') + text.slice(1) : id;
}

/** Clamp a finite numeric option into a safe display range. */
export function boundedNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Resolve numeric view bounds: a literal `*_value_allowed` wins over its
 * `calculated_*` formula, and a non-numeric formula result fails visibly.
 */
export function viewBounds(v: View, evaluate: (input: unknown) => unknown) {
	const bound = (literal: unknown, calculated: unknown, label: string) => {
		if (boundedNumber(literal) !== undefined || calculated == null) return boundedNumber(literal);
		const value = boundedNumber(evaluate(calculated));
		if (value === undefined) throw new Error(`${label}: numero richiesto`);
		return value;
	};
	return {
		minimum: bound(v.min_value_allowed, v.calculated_min_value_allowed, it.tickerMin),
		maximum: bound(v.max_value_allowed, v.calculated_max_value_allowed, it.tickerMax)
	};
}

/** Current value for one input view, preferring session drafts over persisted values. */
export function inputValue(v: View, ctx: InputContext, s: Stat) {
	const base = ctx.drafts && Object.hasOwn(ctx.drafts, v.id) ? ctx.drafts[v.id]
		: ctx.overrides && Object.hasOwn(ctx.overrides, s.id) ? ctx.overrides[s.id]
		: Object.hasOwn(ctx.values, s.id) ? ctx.values[s.id] : s.default_value;
	const modifier = ctx.modifiers?.[s.id];
	return typeof base === 'number' && typeof modifier === 'number' ? base + modifier : base;
}

/** Route one input change to the session draft or the persisted owner. */
export function saveInput(v: View, ctx: InputContext, id: string, value: unknown) {
	if (ctx.onInput) ctx.onInput(v.id, id, value); else ctx.onChange?.(id, value);
}

