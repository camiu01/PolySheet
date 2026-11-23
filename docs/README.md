# Documentation

[← README](../README.md)

## Documents

| Document | What it covers |
| :--- | :--- |
| [Agent instructions](AGENT_INSTRUCTIONS.md) | These instructions supplement the root `AGENTS.md`. |
| [Architecture](ARCHITECTURE.md) | Code ownership, immutable sources, persistence, backup formats and safety limits. |
| [CI and GitHub Pages deployment](CI_CD.md) | Static hosting, Pages gates, data and recovery. |
| [Combat and contextual fields](COMBAT.md) | This is a verified command subset, not a complete RPG Companion rule engine. |
| [Compatibility and source evidence](COMPATIBILITY.md) | How imports are decoded, validated and supported, with source evidence for each system. |
| [Development and testing](DEVELOPMENT.md) | Setup, commands, production browser checks and local-only external fixtures. |
| [D&D 5e compatibility audit](DND5E_AUDIT.md) | Tested workflows, missing catalogs, partial rules and verified source mismatches. |
| [Public GitHub system retrieval](GITHUB_IMPORT.md) | For D&D, open **I miei GDR** and choose the 2014 or 2024 edition. |
| [Shared coding standards](SHARED_CODING_STANDARDS.md) | The following standards are included in this repository so they also apply without personal Droid configuration. |
| [Executed verification](VERIFICATION.md) | Dated results, skips and unverified gaps. |
| [Historical 12:37 checkpoint](VERIFICATION_2026-11-16_1237.md) | Superseded by current verification. |
| [Historical verification records](VERIFICATION_HISTORY.md) | Earlier run records, investigations and build/dependency warnings. These are not current results. |
| [Source views and scoped editing](VIEWS.md) | This is a tested subset, not full upstream UI/event compatibility. |

## Reading paths

### Use PolySheet

- [Getting started and Sentieri](../README.md#try-it-with-sentieri): try the
  original example before importing an external system.
- [Data, backups and offline use](../README.md#your-data-and-offline-use):
  browser-local storage, replacement restore and update precautions.
- [Public GitHub imports](GITHUB_IMPORT.md#use): repository discovery and file choice.
- [Automatic source catalogs](GITHUB_IMPORT.md#source-repositories-and-automatic-catalogs):
  compiled file once, local reuse and one confirmation.
- [Resource links](VIEWS.md#resource-links): JSON files, GitHub folders and web
  folders with an index.
- [Source views and manual editing](VIEWS.md#use): forms, local resources and
  manual recovery when source rules cannot run.
- [Backgrounds and subraces](COMPATIBILITY.md#background-and-subrace-selection)
  and [Druid snapshots](COMPATIBILITY.md#druid-removal-history): exact assignment contracts.
- [Combat](COMBAT.md#use): encounters, initiative and turn controls.
- [5e monsters](VIEWS.md#selective-5e-monsters): selective search/import for
  companion assignments and separate encounter copies.

### Check compatibility

- [Current D&D 5e audit](DND5E_AUDIT.md): tested workflows, missing catalogs,
  partial rules and verified source mismatches.

- [Remaining work](../todo.md): current priorities, reported diagnostic groups,
  completed work and verification gaps.
- [Reading import results](COMPATIBILITY.md#reading-import-results): decoding,
  definition validation, runtime support and actual usability.
- [Feature matrix and source audit](COMPATIBILITY.md#compatibility-matrix):
  implemented contracts, exact examples, provenance and unsupported behavior.
- [Latest verification](VERIFICATION.md): dated results, skips and unverified gaps.
- [Historical verification](VERIFICATION_HISTORY.md): earlier run records,
  investigations and build/dependency warnings. These are not current results.

### Develop and contribute

- [Development and testing](DEVELOPMENT.md): setup, commands, production browser
  checks and local-only external fixtures.
- [Contributing](../CONTRIBUTING.md): documentation, safety and extension rules.
- [Architecture](ARCHITECTURE.md): code ownership, immutable sources, persistence,
  backup formats and safety limits.
- [Design system](../DESIGN.md): charcoal/brass tokens, local fonts and responsive controls.
- [Repository instructions](../AGENTS.md) and [detailed agent instructions](AGENT_INSTRUCTIONS.md).
- [Threat model](../.factory/threat-model.md): trust boundaries and accepted risks.

### Host and redistribute

- [CI and deployment](CI_CD.md): static hosting, Pages gates, data and recovery.
- [License](../LICENSE.md) and [third-party notices](../NOTICE.md):
  original material, dependency attribution and external-content restrictions.
