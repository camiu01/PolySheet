/**
 * @file Source layout views: accordion sections and horizontal page containers.
 * @remarks Page state is local presentation state; it never changes source values.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { RenderView, type RenderContext } from './renderer';
import { gridColumns, textValue, viewColor } from './view-support';
import { it } from './it';

/** Render source children, preserving their own ids and failures. */
function children(items: unknown, context: RenderContext) {
  if (!Array.isArray(items)) throw new Error(it.viewInvalidList);
  return items.map((v, i) => <RenderView key={`${String((v as { id?: string }).id ?? '')}:${i}`} input={v} context={context} />);
}

/**
 * Section content grid that keeps the source minimum width but balances rows.
 * @remarks Six 125px items in a row that fits five wrap as 3 + 3 instead of 5 + 1.
 * Fractional widths, single rows and unmeasured layouts keep the plain source tracks.
 */
export function BalancedGrid({ minWidth, justifyItems, children }: {
  minWidth: unknown; justifyItems: CSSProperties['justifyItems']; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<number | null>(null);
  const pixels = typeof minWidth === 'number' && Number.isFinite(minWidth) && minWidth > 0
    ? (minWidth <= 1 ? null : Math.min(800, minWidth)) : 160;
  const measure = useCallback(() => {
    const element = ref.current;
    if (!element || pixels === null) { setColumns(null); return; }
    const style = getComputedStyle(element);
    const gap = parseFloat(style.columnGap) || 0;
    const width = element.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    const count = element.children.length;
    const fit = Math.max(1, Math.floor((width + gap) / (pixels + gap)));
    setColumns(width > 0 && count > fit ? Math.ceil(count / Math.ceil(count / fit)) : null);
  }, [pixels]);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);
  // Visibility formulas can change the child count without resizing the container.
  useEffect(() => { if (typeof ResizeObserver !== 'undefined') measure(); });
  return <div ref={ref} className="section-content" style={{
    gridTemplateColumns: columns ? `repeat(${columns},minmax(0,1fr))` : gridColumns(minWidth), justifyItems
  }}>{children}</div>;
}

/** Source `collapsible`: accordion with a title, optional subtitle and subviews. */
export function SourceCollapsible({ node: v, context, evaluate }: {
  node: Record<string, unknown>; context: RenderContext; evaluate: (value: unknown) => unknown;
}) {
  const title = v.title == null ? '' : textValue(evaluate(v.title));
  const subtitle = v.subtitle == null ? '' : textValue(evaluate(v.subtitle));
  return <details className="source-collapsible" open={v.start_expanded === true}>
    <summary>
      <strong>{title}</strong>
      {subtitle && <span className="muted">{subtitle}</span>}
    </summary>
    <div className="view-list">{children(v.subviews, context)}</div>
  </details>;
}

/** Source `viewPager`: one visible page at a time with source page names. */
export function SourceViewPager({ node: v, context, evaluate }: {
  node: Record<string, unknown>; context: RenderContext; evaluate: (value: unknown) => unknown;
}) {
  const [page, setPage] = useState(0);
  if (!Array.isArray(v.subviews)) throw new Error(it.viewPagesRequired);
  const rawNames = evaluate(v.names);
  if (!Array.isArray(rawNames) || rawNames.some(name => typeof name !== 'string'))
    throw new Error('I nomi delle pagine devono essere una lista di testi');
  if (rawNames.length !== v.subviews.length) throw new Error(it.viewPageNames);
  const names = rawNames as string[];
  const color = viewColor(v.color, evaluate);
  const index = Math.min(page, names.length - 1);
  return <div className="source-pager">
    <div role="tablist" aria-label={it.pages} className="source-pager-tabs" style={{ borderColor: color }}>
      {names.map((name, i) => <button key={`${name}:${i}`} type="button" role="tab" aria-selected={i === index}
        className="source-pager-tab" style={{ borderColor: i === index ? color : undefined }}
        onClick={() => setPage(i)}>{name}</button>)}
    </div>
    <div role="tabpanel" className="view-list">
      {index >= 0 && <RenderView input={(v.subviews as unknown[])[index]} context={context} />}
    </div>
  </div>;
}
