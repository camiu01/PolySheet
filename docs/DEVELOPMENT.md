# Development and testing

[Documentation index](README.md) · [Contributing](../CONTRIBUTING.md) ·
[Executed checks](VERIFICATION.md)

## Setup

Use Node.js 22.12+ or 24 LTS and npm; CI uses Node.js 24. Run commands from the
repository root. No backend, required cloud service, credentials or `.env` file
is needed.

```sh
npm ci
npm run dev
```

The app uses React, strict TypeScript, Vite, Tailwind, Dexie/IndexedDB, Zustand
and Workbox. See [architecture](ARCHITECTURE.md) for ownership and safety limits.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Loopback development server; no production offline worker |
| `npm run check` | Strict TypeScript and Vitest unit/component/integration tests |
| `npm test` | Vitest; optional external cases skip without their inputs |
| `npm run test:watch` | Vitest watch mode |
| `npm run build` | Type-check and build the static PWA in `dist/` |
| `npm run preview -- --port 4173` | Serve the production build locally |
| `npx playwright install chromium` | Install Chromium for browser acceptance |
| `npm run test:e2e` | Desktop and mobile acceptance against `dist/` |
| `npm run test:external` | Export the historical fixture and require its integration tests |
| `node scripts/package-fixtures.mjs` | Export pinned Archer/derpsy system blobs locally |
| `node scripts/inspect-archer.mjs` | Inspect the pinned Archer system and export its JSON locally |
| `node scripts/icons.mjs` | Rebuild PNG icons from the original SVG |
| `npm audit` | Inspect all dependency advisories |
| `npm audit --omit=dev` | Inspect runtime dependency advisories only |

No Markdown linter, code linter or formatter script is configured. Do not add
dependencies just to validate a documentation-only change.

## Production browser checks

Run these in order; stop if a command fails:

```sh
npm run check
npm run build
npm audit --omit=dev
npx playwright install chromium
```

Keep an existing preview on port 4173 running. In PowerShell, isolate acceptance
tests and exercise a Pages-style subdirectory:

```powershell
$env:PLAYWRIGHT_PORT = '4183'
$env:PLAYWRIGHT_BASE_PATH = '/PolySheet/'
npm run test:e2e -- --max-failures=1
```

On a POSIX shell, the equivalent test command is:

```sh
PLAYWRIGHT_PORT=4183 PLAYWRIGHT_BASE_PATH=/PolySheet/ npm run test:e2e -- --max-failures=1
```

Playwright starts its own production preview; it does not build `dist/`.
It uses Chromium desktop at 1440 × 1000 and Pixel 7 emulation, not a physical
mobile installation. For routing, asset, worker or deployment changes, also run
the suite with `PLAYWRIGHT_BASE_PATH='/'`.

PowerShell 5.1 does not support `&&` or `||`; when automating dependent commands,
check `$LASTEXITCODE` before continuing. Environment variables persist in that
shell. Reset them or use a new shell when switching test modes.

## External fixtures

The original MIT Sentieri/capabilities cases run without external downloads.
Third-party tests are optional and may skip explicitly in a clean checkout.
A green run with skips does not verify those integrations. Check
[NOTICE.md](../NOTICE.md) before obtaining or redistributing fixtures.

The historical, Archer and derpsy export procedures below use pinned Git blobs,
not working-tree contents. The newer complete-catalog cases read the inspected
clean source checkout, as described separately below.
They do not compile RPGScript, establish full rule compatibility or authorize
redistribution. Source inventories, exact digests and compiler investigations
belong in [compatibility](COMPATIBILITY.md), not the quick-start guide.
### Historical monolithic source

Third-party creative content is **not distributed** in `src/`, `public/`, or
`dist/`. The reference checkout and generated files stay under gitignored
`.reference/`. Check its license before local use or redistribution.

```sh
git clone https://github.com/blastervla/rpg-companion-app-systems.git .reference/rpg-companion-app-systems
npm run test:external
npm run build
npm run test:e2e
```

If you already have a full checkout elsewhere, set `RPG_SYSTEMS_REPO` to its
absolute path. A shallow checkout must contain the pinned historical commit.

```powershell
$env:RPG_SYSTEMS_REPO = 'C:\absolute\path\rpg-companion-app-systems'
npm run test:external
```

`scripts/external-fixture.mjs` exports the exact Git blob to
`.reference/5e.json`. The external test also writes
`.reference/5e-slice.json`, an explicitly reduced JSON input usable in the UI
and offline browser tests. No formula, event, or resource semantics are rewritten.

### Archer system distribution

The supplied repository is
[WaMXXVII/Archer-class](https://github.com/WaMXXVII/Archer-class), inspected at
[378bdf68f055bae8777a233fc0ac6e4f9eb6145c](https://github.com/WaMXXVII/Archer-class/tree/378bdf68f055bae8777a233fc0ac6e4f9eb6145c).
It contains compiled distribution artifacts, not a JSON authoring tree.
For this exact revision, `5e/system.rpg` is an observed gzip-JSON payload:
system `5e` version `0.9.1`, 317 stats, 50 resource definitions, and six dice.

```sh
git clone https://github.com/WaMXXVII/Archer-class.git .reference/Archer-class
node scripts/inspect-archer.mjs
npm run check
npm run build
npm run test:e2e
```

The inspection script reads the pinned Git blob, bounds decompression, and
writes `.reference/archer-system.json`. You can import that JSON manually.
The full document passes interpreted-field validation, but its unsupported
mechanics, effects, views and contextual formulas are still reported.
Tests verify the ability-score path, not full 5e or the Archer class.
The separate resource-instance archive is **not imported**.

The inspection script is optional: the browser can now import the original
`5e/system.rpg` directly. Its exact gzip bytes are retained; existing characters
using an earlier extracted JSON remain pinned to that different source import.
This is not a generic `.rpg` decoder or a Git client. No license was found in the
provided repository; none of its content is bundled. A GitHub Pages base URL
returning 404 does not by itself prove its distribution endpoints are broken.

### Reported third-party system distribution

[derpsyhome/3rd-party-books-for-5e](https://github.com/derpsyhome/3rd-party-books-for-5e)
was inspected at
[00f55b2c3023c59f5857297dc933a7505c9b6aa4](https://github.com/derpsyhome/3rd-party-books-for-5e/tree/00f55b2c3023c59f5857297dc933a7505c9b6aa4).
Its `5e/system.rpg` is gzip-JSON for `5e` version `0.6.0`.

In **Da URL**, paste the
[pinned direct system URL](https://raw.githubusercontent.com/derpsyhome/3rd-party-books-for-5e/00f55b2c3023c59f5857297dc933a7505c9b6aa4/5e/system.rpg),
or download that file and choose it with **Scegli file JSON o .rpg**.
Alternatively, paste the repository's root URL, with or without `.git`, set the
optional branch/commit, and select `5e/system.rpg` from the discovered files.
GitHub discovery uses the public API, not the repository's HTML page.
`blob`/`tree` page URLs are not accepted; use the root URL and reference field.

This imports the **system definition**, not the advertised books/classes/races
contained in `resources.rpg.gzip`. Resource archives, `systems.rpg` distribution
indexes, unknown binary `.rpg` formats and `.rpgs` source are rejected explicitly.
Successful decoding does not mean complete rule compatibility.

For reproducible local-only binary tests:

```sh
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/derpsyhome/3rd-party-books-for-5e.git .reference/derpsy-books
git -C .reference/derpsy-books fetch --depth 1 origin 00f55b2c3023c59f5857297dc933a7505c9b6aa4
node scripts/package-fixtures.mjs
npm run check
npm run build
npm run test:e2e
```

The Archer checkout from the preceding section is also required. The fixture
script exports the pinned Git blobs, not the mutable working-tree files.
To run just the live public Raw import check (read-only, no intercept):

```powershell
$env:PLAYWRIGHT_PORT = '4183'
$env:LIVE_RPG_IMPORT = '1'
npm run test:e2e -- --grep 'direct raw .rpg'
Remove-Item Env:LIVE_RPG_IMPORT
```

### Additional official and reported fixtures

The 2026-11-16 official release checks used local originals under
`.reference/official-releases-2026-11-16/`. The historical reported HP regression
requires `.reference/reported-system.rpg`. These inputs are not bundled or
prepared by the scripts above. Their source identities, exact hashes and limits
are in [compatibility](COMPATIBILITY.md#official-compiler-follow-up-2026-11-16)
and the [reported HP investigation](COMPATIBILITY.md#reported-empty-class-hp-failure).
Use only authorized originals matching the pinned identities; do not replace
missing inputs with invented fixtures and report the original case as passed.

### Complete source catalogs and live discovery

Always-on link/removal fixtures in `tests/catalog-url.test.ts`,
`tests/system-removal.test.ts` and the browser suite contain only original MIT
examples. `tests/catalog.test.ts` additionally checks all three real catalogs
when both the source checkout and corresponding compiled originals exist.
Browser real-catalog cases use the same local inputs, with controlled GitHub
responses rather than a live-provider claim.

Use a clean source checkout at
[8788e3b18099e4a1b3510f02869d97f1488586b4](https://github.com/blastervla/rpg-companion-app-systems/tree/8788e3b18099e4a1b3510f02869d97f1488586b4)
under `.reference/rpg-companion-app-systems`. Check it before interpreting
source-specific totals:

```sh
git -C .reference/rpg-companion-app-systems rev-parse HEAD
git -C .reference/rpg-companion-app-systems status --short
npm test -- tests/catalog.test.ts tests/repository.test.ts tests/catalog-url.test.ts tests/system-removal.test.ts
```

The expected source checkout is the recorded commit with no changes. These
optional catalog tests read checkout files, not Git blobs; modified files or a
different revision are not evidence for the recorded snapshot. Original compiled
files belong in `.reference/official-releases-2026-11-16/{5e,5e2024,pf2e}-system.rpg`.
No third-party content is bundled or copied into application fixtures.

For an intentional live GitHub API/Raw check, using the local compiled 5e2024
original and no request interception:

```powershell
$env:PLAYWRIGHT_PORT = '4183'
$env:PLAYWRIGHT_BASE_PATH = '/PolySheet/'
$env:LIVE_REPOSITORY_IMPORT = '1'
npm run test:e2e -- --grep 'live published repository'
Remove-Item Env:LIVE_REPOSITORY_IMPORT
```

This exercises system discovery, the one-time compiled upload, automatic catalogs,
the resource screen's GitHub-folder link, idempotent reimport, explicit class
assignment and offline reopening. The generic web-index mode has controlled
contract/browser tests; arbitrary public servers still need CORS and a valid index.

## Documentation-only changes

Check local Markdown targets and heading anchors, referenced assets, command
names against `package.json`, and statements against their code/configuration
source. Run `git diff --check`, review the final diff and preserve unrelated
working-tree changes. Record what ran and what was skipped in
[verification](VERIFICATION.md); do not copy old application test counts as a new run.

For application changes, follow [CONTRIBUTING.md](../CONTRIBUTING.md) and the
[repository instructions](../AGENTS.md). CI behavior, hosted deployment and
production headers are documented separately in [CI and deployment](CI_CD.md).
