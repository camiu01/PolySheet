/** @file Source-ordered sheet content with keyboard-accessible section shortcuts. */
import { createEvaluator } from '../engine/formulas';
import { object, type StoredSystem } from '../domain/model';
import { RenderView, textValue, type RenderContext } from './renderer';
import { it } from './it';

/** Read source titles without inventing labels or changing source visibility/content. */
export function SheetSections({ sections, context }: {
  sections: StoredSystem['definition']['character_sheet_sections']; context: RenderContext;
}) {
  const evaluator = createEvaluator(context.stats, context.values, undefined, {
    ...context, variables: { $edit_mode: false, ...context.variables }
  });
  const links = sections.flatMap((section, index) => {
    const node = object(section.view);
    if (!Array.isArray(node.header)) return [];
    try {
      if (node.is_visible != null && evaluator.evaluate(node.is_visible) === false) return [];
      const title = node.header.map(item => object(item)).find(v => v.type === 'text' && ['title', 'headline', 'section'].includes(String(v.style)));
      const label = title?.text ? textValue(evaluator.evaluate(title.text)) : section.id;
      return [{ id: `sheet-section-${index}`, label: label || section.id }];
    } catch { return [{ id: `sheet-section-${index}`, label: section.id }]; }
  });
  return <>
    {links.length > 1 && <nav className="sheet-navigation" aria-label={it.sheetSections}>
      <div className="sheet-navigation-links">{links.map(link => <a key={link.id} href={`#${link.id}`}>{link.label}</a>)}
        <a href="#sheet-base-values">{it.baseValuesShort}</a>
        <a href="#sheet-related-resources">{it.assigned}</a>
      </div>
    </nav>}
    {sections.map((section, index) => <div className="sheet-anchor" id={`sheet-section-${index}`} tabIndex={-1} key={section.id}>
      <RenderView input={section.view} context={context} />
    </div>)}
  </>;
}
