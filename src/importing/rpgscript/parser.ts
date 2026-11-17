/** @file Recursive-descent declarations and Pratt expressions for documented RPGScript. */
import { tokenize, type Declaration, type Expr, type Script, type Token } from './syntax';

const precedence: Record<string, number> = { '||': 1, '&&': 2, '??': 3, '==': 4, '!=': 4,
  '<': 5, '<=': 5, '>': 5, '>=': 5, '+': 6, '-': 6, '*': 7, '/': 7, '%': 7 };

/** Parse the complete file; unknown syntax aborts rather than skipping declarations. */
export function parseScript(source: string, path: string): Script {
  return new Parser(tokenize(source, path), path).parse();
}

class Parser {
  private index = 0;
  private depth = 0;
  constructor(private tokens: Token[], private path: string) {}
  private peek(offset = 0) { return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)]; }
  private take() { return this.tokens[this.index++]; }
  private match(text: string) { if (this.peek().text !== text) return false; this.index++; return true; }
  private fail(message: string): never {
    const token = this.peek();
    throw new Error(`${this.path}:${token.line}:${token.column}: ${message}; found ${token.text || 'EOF'}`);
  }
  private expect(text: string) { if (!this.match(text)) this.fail(`Expected ${text}`); }
  private identifier() { if (this.peek().kind !== 'id') this.fail('Expected identifier'); return this.take().text; }
  parse(): Script {
    const result: Script = { imports: [], declarations: [] };
    while (this.peek().kind !== 'eof') {
      if (this.match(';')) continue;
      if (this.match('import')) {
        if (this.peek().kind !== 'string') this.fail('Expected relative import string');
        result.imports.push(this.take().value!); this.match(';'); continue;
      }
      result.declarations.push(this.declaration());
    }
    return result;
  }
  private declaration(): Declaration {
    let partyVisible = false;
    if (this.match('@')) { if (this.identifier() !== 'party_visible') this.fail('Unknown annotation'); partyVisible = true; }
    const kind = this.identifier();
    let valueType: string | undefined, resourceType: string | undefined, array = false;
    if (kind === 'base' || kind === 'calc') {
      valueType = this.identifier();
      if (this.match('<')) {
        const types = [this.identifier()];
        while (this.match('|')) types.push(this.identifier());
        resourceType = types.join(' | '); this.expect('>');
      }
      if (this.match('[')) { this.expect(']'); array = true; }
    }
    const name = this.identifier(), params: string[] = [];
    let meta: Declaration['meta'] = [];
    if (kind === 'define' && this.match('(')) {
      if (!this.match(')')) {
        do { params.push(this.identifier()); } while (this.match(',') && this.peek().text !== ')');
        this.expect(')');
      }
      if (new Set(params).size !== params.length) this.fail('Duplicate macro parameter');
    } else if (this.match('(')) meta = this.arguments(')');
    if (partyVisible && !['base', 'calc'].includes(kind)) this.fail('Annotation requires a stat');
    this.expect('=');
    const value = this.expression();
    this.match(';');
    return { kind, name, value, meta, params, valueType, resourceType, array, partyVisible };
  }
  private arguments(end: string): { name: string; value: Expr }[] {
    const args: { name: string; value: Expr }[] = [];
    if (this.match(end)) return args;
    do {
      let name = 'components';
      if (this.peek().kind === 'id' && this.peek(1).text === '=') { name = this.take().text; this.take(); }
      else if (args.length) this.fail('Only the first argument may be positional');
      if (args.some(arg => arg.name === name)) this.fail(`Duplicate argument ${name}`);
      args.push({ name, value: this.expression() });
    } while (this.match(',') && this.peek().text !== end);
    this.expect(end);
    return args;
  }
  private expression(minimum = 0): Expr {
    if (++this.depth > 64) this.fail('Expression depth exceeds 64');
    try {
      let left = this.primary();
      while ((precedence[this.peek().text] ?? -1) >= minimum) {
        const op = this.take().text;
        left = { kind: 'binary', op, left, right: this.expression(precedence[op] + 1) };
      }
      return left;
    } finally { this.depth--; }
  }
  private primary(): Expr {
    const token = this.take();
    if (token.kind === 'string') return { kind: 'literal', value: token.value! };
    if (token.kind === 'number') {
      const value = Number(token.text);
      if (!Number.isFinite(value)) this.fail('Non-finite number');
      return { kind: 'literal', value, decimal: /[.eE]/.test(token.text) };
    }
    if (['true', 'false', 'null'].includes(token.text)) return { kind: 'literal', value: token.text === 'null' ? null : token.text === 'true' };
    if (['!', '-'].includes(token.text)) return { kind: 'unary', op: token.text, value: this.expression(8) };
    if (token.text === '[') {
      const items: Expr[] = [];
      if (!this.match(']')) {
        do { items.push(this.expression()); } while (this.match(',') && this.peek().text !== ']');
        this.expect(']');
      }
      return { kind: 'list', items };
    }
    if (token.text === '(') return this.groupOrLambda();
    if (token.text === 'if') {
      const condition = this.expression(); this.expect('then');
      const value = this.expression(); this.expect('else');
      const chained = this.peek().text === 'if', fallback = this.expression();
      return { kind: 'when', clauses: [{ condition, value }, ...(chained && fallback.kind === 'when'
        ? fallback.clauses : [{ condition: { kind: 'literal' as const, value: true }, value: fallback }])] };
    }
    if (token.text === 'when') {
      this.expect('{');
      const clauses: Extract<Expr, { kind: 'when' }>['clauses'] = [];
      while (!this.match('}')) {
        const condition: Expr = this.match('else') ? { kind: 'literal', value: true } : this.expression();
        this.expect('->'); clauses.push({ condition, value: this.expression() });
        if (!this.match(',') && this.peek().text !== '}') this.fail('Expected comma in when');
      }
      return { kind: 'when', clauses };
    }
    if (token.kind !== 'id') this.fail('Expected expression');
    if (this.match('=>')) return { kind: 'lambda', params: [token.text], body: this.expression() };
    if (this.match('(')) return { kind: 'call', name: token.text, args: this.arguments(')') };
    return { kind: 'ref', name: token.text };
  }
  private groupOrLambda(): Expr {
    const saved = this.index;
    const params: string[] = [];
    while (this.peek().kind === 'id') {
      params.push(this.take().text);
      if (!this.match(',')) break;
    }
    if (this.match(')') && this.match('=>')) return { kind: 'lambda', params, body: this.expression() };
    this.index = saved;
    const value = this.expression(); this.expect(')');
    return { kind: 'group', value };
  }
}
