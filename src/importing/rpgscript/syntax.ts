/** @file Bounded RPGScript syntax trees; imported text is data, never JavaScript. */
import type { Json } from '../../domain/model';

export type Expr =
  | { kind: 'literal'; value: Json; decimal?: boolean }
  | { kind: 'ref'; name: string }
  | { kind: 'list'; items: Expr[] }
  | { kind: 'call'; name: string; args: { name: string; value: Expr }[] }
  | { kind: 'binary'; op: string; left: Expr; right: Expr }
  | { kind: 'unary'; op: string; value: Expr }
  | { kind: 'group'; value: Expr }
  | { kind: 'lambda'; params: string[]; body: Expr }
  | { kind: 'when'; clauses: { condition: Expr; value: Expr }[] };
export interface Declaration {
  kind: string;
  name: string;
  value: Expr;
  meta: { name: string; value: Expr }[];
  params: string[];
  valueType?: string;
  resourceType?: string;
  array?: boolean;
  partyVisible?: boolean;
}
export interface Script { imports: string[]; declarations: Declaration[] }
export interface Token { kind: string; text: string; value?: string; line: number; column: number }

/** Tokenize once with explicit string/comment termination and a finite token budget. */
export function tokenize(source: string, path: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0, line = 1, column = 1;
  const fail = (message: string): never => { throw new Error(`${path}:${line}:${column}: ${message}`); };
  const advance = () => { const ch = source[pos++]; if (ch === '\n') { line++; column = 1; } else column++; return ch; };
  while (pos < source.length) {
    const ch = source[pos];
    if (/\s|\ufeff/.test(ch)) { advance(); continue; }
    if (source.startsWith('//', pos)) { while (pos < source.length && source[pos] !== '\n') advance(); continue; }
    if (source.startsWith('/*', pos)) {
      advance(); advance();
      while (pos < source.length && !source.startsWith('*/', pos)) advance();
      if (pos === source.length) fail('Unterminated comment');
      advance(); advance(); continue;
    }
    const start = pos, startLine = line, startColumn = column;
    let kind = 'symbol', value: string | undefined;
    if (ch === '"' || ch === "'") {
      const triple = source.startsWith(ch.repeat(3), pos), delimiter = triple ? ch.repeat(3) : ch;
      for (let i = 0; i < delimiter.length; i++) advance();
      value = '';
      while (pos < source.length && !source.startsWith(delimiter, pos)) {
        let next = advance();
        if (next === '\\') {
          const escaped = advance(), escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', '"': '"', "'": "'", '\\': '\\', '$': '$' };
          if (!Object.hasOwn(escapes, escaped)) fail('Unsupported string escape');
          next = escapes[escaped];
        } else if (!triple && next === '\n') fail('Newline in string literal');
        value += next;
      }
      if (pos === source.length) fail('Unterminated string');
      for (let i = 0; i < delimiter.length; i++) advance();
      kind = 'string';
    } else {
      const number = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(pos));
      const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\?(?!\?)|\.[A-Za-z_$][A-Za-z0-9_$]*)*/.exec(source.slice(pos));
      if (number) { kind = 'number'; for (let i = 0; i < number[0].length; i++) advance(); }
      else if (identifier) { kind = 'id'; for (let i = 0; i < identifier[0].length; i++) advance(); }
      else {
        const operator = ['=>', '->', '==', '!=', '<=', '>=', '&&', '||', '??'].find(op => source.startsWith(op, pos));
        if (!operator && !'()[]{},;=+-*/%!<>:@|'.includes(ch)) fail(`Unexpected character ${ch}`);
        for (let i = 0; i < (operator?.length ?? 1); i++) advance();
      }
    }
    tokens.push({ kind, text: source.slice(start, pos), value, line: startLine, column: startColumn });
    if (tokens.length > 400000) fail('Token limit exceeded');
  }
  tokens.push({ kind: 'eof', text: '', line, column });
  return tokens;
}
