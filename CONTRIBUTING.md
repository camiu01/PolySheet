# Contributing

## Start here

See [development and testing](docs/DEVELOPMENT.md) for Node.js requirements,
local startup, production browser checks and optional external fixtures.
The [documentation index](docs/README.md) groups guides by audience.
Read [architecture](docs/ARCHITECTURE.md),
[compatibility](docs/COMPATIBILITY.md) and
[executed verification](docs/VERIFICATION.md) before extending behavior.

For documentation-only changes, check content, local links/anchors, assets,
commands and `git diff --check`. No lint/formatter script is configured.
Do not rerun application suites merely to attach new counts to prose changes.

## Documentation standard

Write project documentation, architecture decisions, code identifiers and
comments in English. UI copy belongs in the Italian and English catalogues under
`src/ui/locales/`; imported game labels
are not translated or rewritten.

Use JSDoc/TSDoc-compatible comments on exported domain functions, public
interfaces, registries, and safety-sensitive boundaries. Describe contracts,
ownership, limits and failure behavior, not an English translation of each
statement. TypeScript carries parameter types; do not duplicate them using
`{Type}` annotations.

```ts
/**
 * Import an immutable source snapshot without changing existing characters.
 * @param original - Exact JSON text, preserved for reproducible export.
 * @returns A validated preview; no storage writes occur here.
 * @throws If JSON structure or safety limits are invalid.
 * @remarks Unsupported features are diagnosed, never emulated.
 * @see https://docs.rpg-companion.app/System/RPGSystem
 */
```

Keep README commands executable and keep the compatibility matrix aligned
with tests. New limitations need a visible diagnostic, a documented example
path, and a regression test. Do not document a proposed test as executed.

## Extending compatibility

1. Read the actual documentation page and a pinned real example.
2. Record source ID/version/commit, exact JSON pointer, semantics, ambiguities,
   and independently expected values in `docs/COMPATIBILITY.md`.
3. Check official tools and licenses before implementing parsers or compilers.
4. Add a formula/view handler and its allowed fields. Do not accept a field
   unless its behavior is implemented or explicitly diagnosed.
5. Add unit tests and a real-path integration test. For rule effects, first
   establish event scoping, lifecycle order, reversal, and aggregation semantics.
6. Keep source documents immutable. Never silently migrate saved characters.
7. Run `npm run check`, `npm run build`, and `npm run test:e2e`.

## Safety and data

Never execute imported JavaScript, use `eval`/`new Function`, interpret HTML,
or import Node filesystem modules into browser code. Keep local fixtures under
`.reference/`; do not commit third-party creative content without verified
redistribution rights and attribution. Preserve user changes and data.

The rules engine must remain independent of React. Use Dexie transactions for
cross-record mutations. A backup validation error must leave all existing
records untouched. Do not add a required cloud or account.

## Documentation conventions

These rules are shared by every project under [camiu01](https://github.com/camiu01) and keep the
documentation consistent from one repository to the next. Follow them when you add or edit any
Markdown file, and update this section in every repository if a rule changes.

### README.md

- Starts with a centered header: title, one-line tagline (`###`), badges on one line, a hero image
  (photo, GIF, render or screenshot), then quick links separated by ` · `.
- The intro prose follows the header, before the first section.
- Top-level sections, in this order, omitting the ones that do not apply:
  **What it does**, **Getting started**, **Usage**, **Configuration**, **How it works**,
  **Limitations**, **Development**, **License**.
- When a section is renamed, keep the old anchor with `<a id="old-anchor"></a>` above the heading.

### TODO.md

- Title `# TODO`, followed by `> Last reviewed: YYYY-MM-DD`.
- One `##` section per **area** of the project (for example Firmware, Web dashboard, Docs, CI).
  Areas are ordered by how much open work they hold.
- Inside an area, open items come first as `- [ ] **Short title** — context`, then completed
  items as `- [x] ...`. Use `Blocked:` or `Needs hardware:` at the start of the context when an
  item cannot progress.
- Completed items that shipped in a release move to `CHANGELOG.md`; keep only recent ones here.

### CHANGELOG.md

- Follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).
- Newest first: `## [Unreleased]`, then `## [x.y.z] - YYYY-MM-DD` (or `## YYYY-MM-DD` for projects
  without version numbers).
- Entries are grouped under `### Added`, `### Changed`, `### Deprecated`, `### Removed`,
  `### Fixed` and `### Security`, omitting empty groups.

### docs/

- `docs/README.md` is the index: the title, then a table of every document with a one-line
  description, then any reading paths.
- Every other file in `docs/` starts with its `# Title` followed by the navigation line
  `[← README](../README.md) · [Docs index](README.md)`.
- File-level comments required by a project (such as `@file`/`@brief`) stay above the title.

### Commits and files

- No AI attribution lines (such as `Co-Authored-By`) in commit messages or pull requests.
- Preserve each file's existing line endings and encoding.
