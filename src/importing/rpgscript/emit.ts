/** @file Schema-directed lowering, with bounded macro expansion and no evaluation. */
import schemaInput from './schema.json';
import type { Json } from '../../domain/model';
import type { Declaration, Expr } from './syntax';

interface ClassInfo { id: string; parent: string | null; fields: Record<string, string> }
const schema: Record<string, ClassInfo> = schemaInput;
export interface Macro { declaration: Declaration }
export interface Context { macros: Map<string, Macro>; bindings: Map<string, { expr: Expr; context: Context }>; stack: Macro[] }
export interface Budget { nodes: number; depth: number }
const formula = 'StatFormulaComponent';
const list = (components: Json[]) => ({ type: 'list', components });
const constant = (value: Json, decimal = false) => ({
  type: 'constant', value,
  value_type: value === null ? 'string' : typeof value === 'boolean' ? 'bool'
    : typeof value === 'number' ? decimal || !Number.isInteger(value) ? 'decimal' : 'integer' : 'string'
});
const safeKey = (name: string) => {
  if (['__proto__', 'constructor', 'prototype'].includes(name)) throw new Error(`Forbidden source key: ${name}`);
  return name;
};
const aliases: Record<string, string> = { view: 'RPGView', mechanic: 'Mechanic',
  character_sheet_section: 'CharacterSheetSection', character_creation_page: 'CharacterCreationPage',
  combatant: 'Combatant', combat_system: 'CombatSystem', initiative_system: 'InitiativeSystem', difficulty_level: 'DifficultyLevel',
  resource: 'Resource', enumerated_type: 'EnumeratedType', dice: 'RPGDice', event: 'Event' };
const operators: Record<string, string> = { '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide',
  '%': 'mod', '==': 'equals', '!=': 'notEquals', '<': 'lessThan', '<=': 'lessThanEquals',
  '>': 'greaterThan', '>=': 'greaterThanEquals', '&&': 'and', '||': 'or' };
const lambdaKeys: Record<string, Record<string, [string, string][]>> = {
  map: { mapper: [['map_value_key', '$mapValue']] },
  flatMap: { mapper: [['map_value_key', '$mapValue']] },
  filter: { filter: [['filter_value_key', '$filterValue']] },
  findFirst: { filter: [['find_first_value_key', '$findFirstValue']] },
  sortBy: { sort_by_selector: [['sort_by_value_key', '$sortByValue']] },
  reduce: { reducer: [['reduce_accumulator_key', '$reduceAccumulator'], ['reduce_value_key', '$reduceValue']] },
  forEach: { apply: [['for_each_value_key', '$forEachValue']] }
};

function resolve(expr: Expr, context: Context, budget: Budget): { expr: Expr; context: Context } {
  if (++budget.nodes > 400000) throw new Error('Source expansion exceeds 400,000 nodes');
  if (expr.kind === 'group') return resolve(expr.value, context, budget);
  if (expr.kind === 'ref' && context.bindings.has(expr.name)) {
    const binding = context.bindings.get(expr.name)!;
    return resolve(binding.expr, binding.context, budget);
  }
  const macro = expr.kind === 'ref' || expr.kind === 'call' ? context.macros.get(expr.name) : undefined;
  if (!macro) return { expr, context };
  if (context.stack.length >= 32 || context.stack.includes(macro)) throw new Error('Recursive macro expansion');
  const args = expr.kind === 'call' ? expr.args : [], parameters = macro.declaration.params;
  if (args.length !== parameters.length || args.some(arg => !parameters.includes(arg.name)))
    throw new Error(`Macro ${macro.declaration.name}: expected named parameters ${parameters.join(', ')}`);
  const bindings: Context['bindings'] = new Map();
  for (const arg of args) bindings.set(arg.name, { expr: arg.value, context });
  return resolve(macro.declaration.value, { macros: context.macros, bindings, stack: [...context.stack, macro] }, budget);
}

function primitive(input: Expr, context: Context, budget: Budget): Json {
  const resolved = resolve(input, context, budget), expr = resolved.expr; context = resolved.context;
  if (expr.kind === 'list') return expr.items.map(item => primitive(item, context, budget));
  if (expr.kind === 'unary' && expr.op === '-') {
    const value = primitive(expr.value, context, budget);
    if (typeof value === 'number') return -value;
  }
  if (expr.kind !== 'literal') throw new Error(`Expected a literal, not ${expr.kind}${expr.kind === 'ref' || expr.kind === 'call' ? ' ' + expr.name : ''}`);
  if (typeof expr.value !== 'string') return expr.value;
  return expr.value.replace(/\$\{([A-Za-z_$][A-Za-z0-9_$]*)\}/g, (original, name: string) => {
    const binding = context.bindings.get(name);
    if (!binding) return original;
    const value = primitive(binding.expr, binding.context, budget);
    if (typeof value !== 'string') throw new Error(`Interpolation ${name} requires a string literal`);
    return value;
  });
}

/** Lower one typed expression; depth and expansion are shared across the whole system. */
export function emit(input: Expr, expected: string, context: Context, budget: Budget): Json {
  if (++budget.depth > 64) throw new Error('Source expansion depth exceeds 64');
  try {
    const resolved = resolve(input, context, budget), expr = resolved.expr; context = resolved.context;
    expected = expected.replace(/\?$/, '');
    if (expr.kind === 'literal' && expr.value === null && expected !== formula) return null;
    const array = /^List<(.+)>$/.exec(expected);
    if (array) {
      if (expr.kind !== 'list' && array[1] === formula) return [emit(expr, formula, context, budget)];
      if (expr.kind !== 'list') throw new Error(`Expected ${expected}`);
      return expr.items.map(item => emit(item, array[1], context, budget));
    }
    if (expected === 'Map<String, StatFormulaComponent>') {
      if (expr.kind !== 'call' || expr.name !== 'dict') throw new Error('Expected dict for formula map');
      return Object.fromEntries(expr.args.map(arg => [safeKey(arg.name), emit(arg.value, formula, context, budget)]));
    }
    if (expected === 'Map<String, dynamic>') {
      if (expr.kind !== 'call' || expr.name !== 'payload') throw new Error('Expected payload constructor');
      return Object.fromEntries(expr.args.map(arg => {
        const value = primitive(arg.value, context, budget);
        if (value !== null && typeof value === 'object') throw new Error('Payload values must be literal primitives');
        return [safeKey(arg.name), value];
      }));
    }
    if (!['StatFormulaComponent', 'Effect', 'RPGView'].includes(expected) && !schema[expected])
      return primitive(expr, context, budget);
    if (expected === formula && expr.kind !== 'call') return emitFormula(expr, context, budget);
    if (expr.kind === 'when' && expected === 'Effect') return {
      type: 'when', clauses: expr.clauses.map(c => ({
        condition: emit(c.condition, formula, context, budget), effect: emit(c.value, 'Effect', context, budget)
      }))
    };
    if (expr.kind !== 'call') throw new Error(`Expected a ${expected} constructor`);
    return emitCall(expr, expected, context, budget);
  } finally { budget.depth--; }
}

function emitFormula(expr: Expr, context: Context, budget: Budget): Json {
  if (expr.kind === 'literal') return constant(primitive(expr, context, budget), expr.decimal);
  if (expr.kind === 'ref') return { type: 'stat', stat: expr.name };
  if (expr.kind === 'list') return list(expr.items.map(item => emit(item, formula, context, budget)));
  if (expr.kind === 'when') return { type: 'when', clauses: expr.clauses.map(c => ({
    condition: emit(c.condition, formula, context, budget), components: emit(c.value, formula, context, budget)
  })) };
  if (expr.kind === 'unary') {
    const value = emit(expr.value, formula, context, budget);
    if (expr.op === '-' && value && !Array.isArray(value) && typeof value === 'object'
      && value.type === 'constant' && typeof value.value === 'number') return { ...value, value: -value.value };
    return { type: expr.op === '-' ? 'negate' : 'not', components: value };
  }
  if (expr.kind !== 'binary') throw new Error('Unexpected lambda outside a supported call');
  if (expr.op === '??') return { type: 'defaultIfNull',
    components: emit(expr.left, formula, context, budget), default_components: emit(expr.right, formula, context, budget) };
  const chain: Expr[] = [];
  let value: Expr = expr;
  while (value.kind === 'binary' && value.op === expr.op && ['+', '-', '*', '&&', '||'].includes(expr.op)) {
    chain.push(value.right); value = value.left;
  }
  chain.push(value); chain.reverse();
  if (chain.length === 1) { chain.length = 0; chain.push(expr.left, expr.right); }
  const concat = expr.op === '+' && chain.some(v => v.kind === 'list' || v.kind === 'literal' && typeof v.value === 'string');
  return { type: concat ? 'concat' : operators[expr.op], components: list(chain.map(v => emit(v, formula, context, budget))) };
}

function emitCall(expr: Extract<Expr, { kind: 'call' }>, expected: string, context: Context, budget: Budget): Json {
  const entry = Object.entries(schema).find(([name, item]) =>
    (name === expected || item.parent === expected) && (item.id === expr.name || name[0].toLowerCase() + name.slice(1) === expr.name));
  if (!entry) throw new Error(`Unknown ${expected} constructor: ${expr.name}`);
  const [className, info] = entry;
  const result: Record<string, Json> = ['StatFormulaComponent', 'Effect', 'RPGView'].includes(info.parent ?? '') ? { type: info.id } : {};
  for (const arg of expr.args) {
    const name = safeKey(arg.name);
    // The current publisher added this formula after the extension's schema release.
    const type = info.fields[name] ?? (className === 'Combatant' && name === 'is_defeated' ? formula : undefined);
    if (!type) throw new Error(`Unknown argument ${expr.name}.${name}`);
    const resolved = resolve(arg.value, context, budget);
    if (resolved.expr.kind !== 'lambda') {
      try { result[name] = emit(resolved.expr, type, resolved.context, budget); }
      catch (error) { throw new Error(`${expr.name}.${name}: ${error instanceof Error ? error.message : String(error)}`); }
      continue;
    }
    const lambda = resolved.expr, keys = lambdaKeys[expr.name]?.[name];
    if (!keys || keys.length !== lambda.params.length || new Set(lambda.params).size !== lambda.params.length)
      throw new Error(`Unsupported lambda in ${expr.name}.${name}`);
    for (let i = 0; i < keys.length; i++) if (lambda.params[i] !== keys[i][1]) result[keys[i][0]] = lambda.params[i];
    const bindings = new Map(resolved.context.bindings);
    lambda.params.forEach(param => bindings.delete(param));
    result[name] = emit(lambda.body, type, { ...resolved.context, bindings }, budget);
  }
  return result;
}

/** Compile a declaration without adding default rules or replacing missing source values. */
export function emitDeclaration(declaration: Declaration, macros: Map<string, Macro>, budget: Budget): Json {
  const context: Context = { macros, bindings: new Map(), stack: [] };
  const { kind, valueType, array, resourceType, name } = declaration;
  const meta: Record<string, Json> = {};
  const stat = kind === 'base' || kind === 'calc';
  const expected = stat ? kind === 'base' ? 'BaseStat' : 'ComputedStat' : aliases[kind];
  if (!expected) throw new Error(`Unknown declaration ${kind}`);
  for (const arg of declaration.meta) {
    const type = schema[expected]?.fields[arg.name];
    if (!type) throw new Error(`Unknown declaration argument ${kind}.${arg.name}`);
    const eventString = ['event_names', 'revert_event_names'].includes(arg.name) && arg.value.kind === 'literal' && typeof arg.value.value === 'string';
    meta[safeKey(arg.name)] = emit(arg.value, eventString ? 'String' : type, context, budget);
  }
  if (stat) return {
    id: safeKey(name), type: kind === 'base' ? 'base' : 'calculated', value_type: array ? 'array' : valueType!,
    ...(array ? { sub_value_type: valueType! } : {}), ...(resourceType ? { resource_type: resourceType } : {}),
    ...meta, ...(kind === 'base' ? { default_value: primitive(declaration.value, context, budget) }
      : { components: emit(declaration.value, formula, context, budget) }),
    ...(declaration.partyVisible ? { party_visible: true } : {})
  };
  const body = emit(declaration.value, kind === 'mechanic' ? 'Effect' : kind === 'character_sheet_section' ? 'RPGView' : expected, context, budget);
  if (kind === 'mechanic') return { id: name, effects: body, ...meta };
  if (kind === 'character_sheet_section') return { id: name, view: body, ...meta };
  if (kind === 'view' && body && typeof body === 'object' && !Array.isArray(body)) return { id: name, ...body };
  return body;
}
