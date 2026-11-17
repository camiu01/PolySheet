/** @file Compile a bounded, commit-pinned source snapshot without filesystem or network access. */
import type { Json } from '../../domain/model';
import { boundedJson, MAX_SYSTEM_BYTES } from '../system';
import { emitDeclaration, type Budget, type Macro } from './emit';
import { parseScript } from './parser';
import type { Script } from './syntax';
import { composeDirectory } from './compose';

/** Resolve relative macro imports within the same repository, never a URL or another host. */
export function sourceImportPath(from: string, input: string): string {
  if (!input || input.length > 1024 || /[:\\?#\u0000-\u001f\u007f]/.test(input) || input.startsWith('/'))
    throw new Error(`Invalid source import: ${input}`);
  const parts = from.split('/').slice(0, -1);
  for (const part of input.split('/')) {
    if (part === '.') continue;
    if (part === '..') { if (!parts.length) throw new Error('Import escapes the repository'); parts.pop(); }
    else if (!part || ['__proto__', 'prototype', 'constructor'].includes(part)) throw new Error('Invalid source import segment');
    else parts.push(part);
  }
  if (!parts.at(-1)?.endsWith('.rpgs')) throw new Error('Imports must name an RPGScript file');
  return parts.join('/');
}

/** Extract only declared import paths, using the actual lexer/parser rather than regex scanning. */
export function scriptImports(original: string, path: string): string[] {
  return parseScript(original, path).imports.map(input => sourceImportPath(path, input));
}

/** Compose every system part and imported macro at one revision; unsupported input fails closed. */
export function compileSources(files: ReadonlyMap<string, string>, root: string): Json {
  if (!files.has(root) || !root.endsWith('/system.rpg.json')) throw new Error('Missing source system root');
  if (files.size > 1000 || [...files.values()].reduce((sum, text) => sum + new TextEncoder().encode(text).length, 0) > MAX_SYSTEM_BYTES)
    throw new Error('Source snapshot exceeds 1,000 files or 8 MiB');
  const scripts = new Map<string, Script>(), scopes = new Map<string, Map<string, Macro>>();
  const budget: Budget = { nodes: 0, depth: 0 };
  function script(path: string) {
    if (!scripts.has(path)) {
      const text = files.get(path);
      if (text === undefined) throw new Error(`Missing source dependency: ${path}`);
      scripts.set(path, parseScript(text, path));
    }
    return scripts.get(path)!;
  }
  function scope(path: string, depth = 0): Map<string, Macro> {
    if (depth > 32) throw new Error('Source import depth exceeds 32');
    if (scopes.has(path)) return scopes.get(path)!;
    const result = new Map<string, Macro>();
    scopes.set(path, result);
    for (const relative of script(path).imports) {
      for (const [name, macro] of scope(sourceImportPath(path, relative), depth + 1)) result.set(name, macro);
    }
    const names = new Set<string>();
    for (const declaration of script(path).declarations.filter(d => d.kind === 'define')) {
      if (names.has(declaration.name)) throw new Error(`${path}: duplicate macro ${declaration.name}`);
      names.add(declaration.name);
      result.set(declaration.name, { declaration });
    }
    return result;
  }
  function node(path: string): Json | undefined {
    const text = files.get(path)!;
    if (!path.endsWith('.rpgs')) return boundedJson(text) as Json;
    const parsed = script(path), macros = scope(path);
    const declarations = parsed.declarations.filter(d => d.kind !== 'define');
    if (!declarations.length) return undefined;
    try {
      const compiled = declarations.map(d => {
        try { return emitDeclaration(d, macros, budget); }
        catch (error) { throw new Error(`${d.name}: ${error instanceof Error ? error.message : String(error)}`); }
      });
      return declarations.every(d => ['base', 'calc'].includes(d.kind)) || compiled.length > 1 ? compiled : compiled[0];
    } catch (error) {
      throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const result = composeDirectory(files, root.slice(0, root.lastIndexOf('/')), node, true);
  return boundedJson(JSON.stringify(result)) as Json;
}
