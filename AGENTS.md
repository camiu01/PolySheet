# Repository Guidelines

Read [agent instructions](docs/AGENT_INSTRUCTIONS.md) and
[CONTRIBUTING.md](CONTRIBUTING.md) before editing, along with the relevant project
documents they list. Follow the [shared coding standards](docs/SHARED_CODING_STANDARDS.md);
project-specific guidance overrides shared defaults, and directory instructions
take precedence within their scope.

## Project structure

PolySheet is a local-first RPG companion PWA built with React, strict TypeScript,
Vite, Tailwind and Workbox. Do not add a backend, accounts or analytics.

- `src/domain/`: contracts and validators; `src/engine/`: React-independent rules and view sessions.
- `src/importing/`: source parsing and compatibility diagnostics; `src/persistence/`: Dexie storage, transactions and backups.
- `src/ui/`: interface and localized copy (`locales/` catalogues); `public/`: static assets; `scripts/`: fixture and asset tooling.
- `tests/`: Vitest suites; `tests/e2e/`: Playwright acceptance tests. Keep external fixtures in gitignored `.reference/`.

## Development and validation

Use Node.js 22.12+ or 24 LTS. Run from the repository root:

- `npm ci` installs locked dependencies; `npm run dev` starts Vite locally.
- `npm run check` type-checks and runs Vitest; `npm run build` produces `dist/`.
- `npm audit --omit=dev` checks runtime dependencies.
- `npm run test:e2e -- --max-failures=1` checks the production build on desktop and mobile. Set `PLAYWRIGHT_PORT=4183` and `PLAYWRIGHT_BASE_PATH=/PolySheet/` as shown in [the development guide](docs/DEVELOPMENT.md#production-browser-checks). Preserve port 4173; also test `/` for routing, assets, worker or deployment changes.

Stop on failures. For documentation-only changes, check content, paths and `git diff --check` instead.

## Coding and tests

Use two spaces, single quotes, PascalCase components and camelCase functions.
No formatter or linter script is configured. Write documentation, identifiers
and contract comments in English; keep interface copy in the Italian and English
catalogues and imported labels unchanged.

Dexie owns persistent data; Zustand holds temporary UI state. Reuse registries
and helpers. Preserve exact source bytes, validation limits and user data.
Never execute imported code or emulate unsupported rules.

Use Vitest and React Testing Library in `*.test.ts` or `*.test.tsx`. Add tests
for features and fixes without lowering coverage. Reproduce bugs with original
inputs and assert independently expected results. Report skips and record checks
in [verification](docs/VERIFICATION.md).

## Commits and pull requests

Review diffs and preserve unrelated work. Commit or push only when requested.
Use short, imperative English Conventional Commits, such as `fix(import): preserve source bytes`.
PRs describe scope, compatibility limits and checks, link relevant issues and
include screenshots for UI changes. Exclude secrets, external fixtures, generated
output, AI co-authoring trailers and session links.
