# Repository Guidelines

## Required reading

Read [the detailed agent instructions](docs/AGENT_INSTRUCTIONS.md) and
[CONTRIBUTING.md](CONTRIBUTING.md) before changing this repository. Their
requirements remain mandatory. Read the relevant architecture, compatibility,
combat, verification, deployment, provenance and threat-model documents listed
there. More specific directory instructions take precedence.

## Project structure

PolySheet is a local-first RPG companion PWA built with React, strict TypeScript,
Vite, Tailwind and Workbox. Do not add a backend, accounts or analytics.

- `src/domain/`: contracts and validation.
- `src/engine/`: React-independent formulas and view sessions.
- `src/importing/`: source parsing and compatibility diagnostics.
- `src/persistence/`: Dexie storage, transactions and backups.
- `src/ui/`: notebook-style controls and Italian copy in `it.ts`.
- `tests/`: Vitest tests; `tests/e2e/`: Playwright acceptance tests.
- `public/`: static assets; `scripts/`: fixture and asset tooling.
- `.reference/`: gitignored external fixtures; `dist/`: generated production build.

## Development and validation

Use Node.js 22.12+ or 24 LTS and npm. Run commands from the repository root:

```sh
npm ci
npm run dev
npm run check
npm run build
npm audit --omit=dev
PLAYWRIGHT_PORT=4183 PLAYWRIGHT_BASE_PATH=/PolySheet/ npm run test:e2e -- --max-failures=1
```

`check` runs TypeScript and Vitest. Playwright tests the production build on
desktop and mobile. Stop on failures; preserve any preview on port 4173.
Also test `/` for routing, asset, worker or deployment changes.
Documentation-only changes require content, path and diff checks.

## Coding and testing conventions

Follow existing two-space indentation, single-quoted TypeScript strings,
PascalCase components and camelCase functions. No formatter or linter script
is configured. Write documentation, identifiers and contract comments in English;
keep UI copy Italian and imported labels unchanged.

Dexie owns persistent data; Zustand holds ephemeral UI state. Reuse existing
registries and helpers. Preserve exact source bytes, validation limits and user
data. Never execute imported code or simulate unsupported rules.

Use `*.test.ts` or `*.test.tsx` with Vitest and React Testing Library.
Reproduce reported bugs with original inputs and add independently expected
regressions. Report skipped external fixtures and record executed checks in
`docs/VERIFICATION.md`.

## Commits and pull requests

Inspect status and diffs; preserve unrelated work. Commit or push only when
requested. Prefer short imperative subjects, using existing `feat:` style when
appropriate. Describe scope, compatibility limits and checks in PRs; include
screenshots for UI changes and link relevant issues. Never commit secrets,
external fixtures or generated test/build output.

## Shared coding standards

The following standards are included in this repository so they also apply
without personal Droid configuration. The project-specific instructions above,
the required project documents and more specific directory instructions take
precedence over these shared defaults. In particular, preserve this project's
two-space indentation, existing directory layout, Italian UI copy and local-first
architecture; the generic layouts below do not authorize adding a backend or
moving existing files. Apply language-specific rules only to that language.
Do not reformat or restructure unrelated code to enforce these standards.

## 1. CODE STYLE, SYNTAX & DOCUMENTATION (Cross-Language)
- **Indentation:** Always use TABS for indentation across all languages (never spaces).

- **Code Metrics & Maintainability Thresholds:**
	- **Function Length:** Functions must not exceed 50 lines of executable code. If a function grows larger, extract modular sub-functions.
	- **File Length:** Source files should be kept under 400 lines. Split architectures into cohesive modules or partial components when passing this limit.
	- **Complexity:** Keep cyclomatic complexity low. Avoid nested conditionals deeper than 3 levels. Prefer guard clauses and early exits.

- **Language Requirements:** All code documentation, file headers, block comments, inline comments, and structural blueprints must be written strictly in **ENGLISH**.

## 2. APPLICATION SECURITY & CONCURRENCY
- **OWASP Compliance:** Prevent Injection vulnerabilities at all costs. Raw SQL string concatenation is strictly banned; use parameterized queries, ORM systems, or safe query builders. Sanitise all HTML/user inputs before persistence or rendering to prevent XSS.
- **Thread & State Safety:** Avoid global mutable states. In multi-threaded runtimes (.NET, C), encapsulate shared contexts using thread-safe collections, mutexes, or atomic primitives to eliminate race conditions. In Node.js, do not block the event loop with synchronous intensive computational blocks.

## 3. ERROR HANDLING & LOGGING
- **Defensive Data Safety:** Validate inputs using domain schemas, strongly typed definitions, or parsing frameworks immediately at boundaries.
- **Error Handling:** Never swallow exceptions. Empty `catch` blocks are strictly forbidden. Always log the full exception context or bubble it up contextually via custom domain exceptions.
- **Structured Logging:** Raw print/log statements (`console.log`, `printf`, `Console.WriteLine`) are banned in production runtimes. Use structured logging providers with appropriate log levels (`DEBUG`, `INFO`, `WARN`, `ERROR`).

## 4. CHAT INTERACTION & "NO FLUFF"
- **No Fluff:** Do not write polite greetings, conversational filler, or summaries of what you are about to do. Execute immediately.
- **Progress Updates:** Use short, single-line text status updates (e.g., "Searching for bugs...", "Fixing line 42...").
- **Modifications:** Never delete existing comments, JSDoc, Doxygen, XML documentation, or inline documentation unless completely rewriting the underlying logic. If logic is modified, the top-level block documentation MUST be updated synchronously to reflect the changes. Immediately notify the user in the chat if a new package or dependency is installed.

## 5. COMMENT QUALITY & "NO AI-SLOP"
- **Zero AI-slop comments:** Never write generic, obvious, or ChatGPT-style comments that merely repeat what the code already says. Comments like `// increment counter` above `i++` or `// check if user is valid` above `if (user.isValid)` are strictly forbidden — they add noise, not value.
- **Comments only for the non-obvious:** Inline comments must be reserved exclusively for code that is genuinely hard to understand at a glance: complex business rules, non-trivial workarounds, performance optimizations with counter-intuitive logic, or historical context ("why this is done this way"). If the code is self-explanatory, leave it uncommented.
- **Prefer expressive code over comments:** Write code that is so clear it needs no explanation. Use descriptive variable/function names, guard clauses, and early returns instead of adding comments to clarify confusing logic.
- **JSDoc/Doxygen/XML docblocks are exempt:** Formal API documentation blocks (parameters, return types, exceptions) are mandatory where specified in section 1. This rule applies only to inline comments within function bodies.

## 6. TESTING & DEPENDENCY MANAGEMENT
- **Automated Tests Requirement:** Every new feature or bug fix must be accompanied by corresponding Unit or Integration Tests using the framework present in the workspace. Do not degrade the existing code coverage.
- **Package Hygiene:** Do not add third-party libraries unless strictly necessary. If a package is required, lock its exact version (*version pinning*). Never use generic `latest` or wildcard `*` tags in dependency definitions (`package.json`, `.csproj`, etc.).

## 7. ANTI-LOOP & WORKSPACE SECURITY
- **Anti-Loop Lock:** If a test/validation command fails 3 times in a row for the same issue, STOP executing immediately. Halt the pipeline, present the errors in chat, and wait for manual guidance.
- **Secrets & Git Protection:** NEVER hardcode secrets, API keys, connection strings, or tokens. Always reference them via environment variables or secure configuration providers (e.g., process.env or appsettings.json/UserSecrets in .NET). Never modify, add, or stage local configuration secret files to Git.

## 8. REPOSITORY & COMMIT STANDARDS
- **Git Commit Messages:** All commit messages must follow the *Conventional Commits* specification and be written in **ENGLISH** (e.g., `feat(auth): add jwt token rotation`, `fix(api): escape input payload exceptions`).
- **Language Routing:**
	- **Chat Interaction — Mirror the user's latest message language:** The response language MUST match the language of the user's **most recent chat message** exactly. If the user's last message is in English, respond in English. If it is in Italian, respond in Italian. Do NOT infer the user's native language from conversation history or earlier messages — only the latest message matters. When in doubt or if the language is ambiguous, default to **English**.
	- **Artifacts:** Regardless of the chat language, all generated structured blueprints, technical specifications, top-level/block code documentation, inline comments, system architecture sheets, and Git logs MUST be written strictly in **ENGLISH**.
- **Emoji Policy:** Only use emojis if the user explicitly requests them. Do not add emojis to code, comments, documentation, commit messages, or any artifact unless the user asks for them.

## LANGUAGE-SPECIFIC CODING STANDARDS

### .NET (C#) Standards
- **Documentation (XML):** Every class, interface, and public/protected member must have a triple-slash (`///`) XML documentation block with `<summary>`, `<param>`, and `<returns>`.
- **Semicolons:** Always terminate statements with semicolons (;).
- **Naming:** PascalCase for Classes, Structs, Methods, Interfaces (prefixed with I), Properties, and Namespaces; camelCase for parameters and local variables; camelCase prefixed with an underscore (_camelCase) for private fields.
- **Files and Folders:** PascalCase matching the primary type definition contained within the file.
- **Paradigm:** Prefer async/await pattern for asynchronous tasks. Use LINQ queries intentionally and avoid excessive mutation.

### JavaScript Standards
- **Documentation (JSDoc):** Every function must have a top-level block detailing `@purpose`, `@param {type}`, and `@returns {type}`.
- **Quotes:** Use single quotes ('') for strings; use double quotes ("") only in JSON or HTML templates.
- **Semicolons:** Always terminate statements with semicolons (;).
- **Naming:** camelCase for variables/functions/instances; PascalCase for Classes and Components; kebab-case for files and folders.
- **Paradigm:** Prefer async/await over raw Promises. Use arrow functions for standard utility functions and internal callbacks. Avoid mutating method arguments.

### Python Standards
- **Documentation (Google-style docstrings):** Every module must have a module-level docstring. Every class and public function/method must have a docstring with `Args:`, `Returns:`, and `Raises:` sections where applicable.
- **Indentation:** Use TABS (consistent with global rule).
- **Naming:** snake_case for variables, functions, methods, and module names; PascalCase for classes; UPPER_CASE for constants.
- **Type Hints:** Always use type hints for function signatures (`def fetch_data(url: str) -> dict:`). Use `Optional` and `Union` from `typing` where needed.
- **Quotes:** Prefer double quotes (`"`) for docstrings and triple-double-quotes (`"""`) for multi-line strings. Use single quotes (`'`) for short string literals.
- **Paradigm:** Prefer explicit over implicit. Use list/dict comprehensions for simple transformations. Avoid mutable default arguments.
- **Imports:** Group imports in order: standard library, third-party, local application. Separate groups with a blank line.

### Rust Standards
- **Documentation (doc comments):** Every public item must have a `///` doc comment. Crate/module-level docs use `//!`. Include `# Arguments`, `# Returns`, `# Panics`, `# Errors`, and `# Safety` sections where applicable.
- **Indentation:** Use TABS (consistent with global rule).
- **Naming:** snake_case for variables, functions, methods, and module names; PascalCase for types, structs, enums, and traits; SCREAMING_SNAKE_CASE for constants and statics.
- **Semicolons:** Always terminate statements with semicolons (`;`).
- **Ownership & Borrowing:** Prefer references (`&T`, `&mut T`) over owned values in function parameters where ownership transfer is not required. Use `Clone` sparingly and intentionally.
- **Error Handling:** Use `Result<T, E>` for recoverable errors and `Option<T>` for optional values. Avoid unwrap/expect in production code -- propagate errors with `?` or map them to domain error types.
- **Unsafe Code:** Minimize `unsafe` blocks. Every `unsafe` block must include a `// SAFETY:` comment explaining why the invariants are upheld.
- **Paradigm:** Favor idiomatic Rust -- use enums instead of stringly-typed values, implement `Default` and `From`/`TryFrom` traits where appropriate, prefer iterator combinators over explicit loops.
- **Imports:** Group imports in order: `std`, external crates, `crate`/`self`/`super`. Use `{ }` for multiple items from the same module.

### TypeScript / Node.js Standards
- **Documentation (JSDoc):** Follow JS standards but omit redundant type definitions in JSDoc tags since TS enforces types natively. Focus on business logic intent.
- **Quotes:** Use single quotes ('') for strings; use double quotes ("") only in JSON or HTML templates.
- **Semicolons:** Always terminate statements with semicolons (;).
- **Naming:** camelCase for variables/functions/instances; PascalCase for Classes/Interfaces/Components; kebab-case for files and folders.
- **Paradigm:** Prefer async/await over raw Promises. Keep functions pure and prefer arrow functions. Ensure strict type definitions are respected.

#### GLOBAL CODEBASE ARCHITECTURE STANDARDS

You must strictly adhere to the following project structures for any architectural planning, file creation, or code analysis. Do not create files outside of these designated directories.

##### 1. Frontend Architecture (React)
All frontend code lives under the `src/` directory and must follow this layout:

* **`src/assets/`**: Static files (images, icons, fonts, etc.).
* **`src/components/`**: UI components organized into thematic folders.
	* `common/`: Global reusable components (e.g., `sidebar.ts`, `table.ts`).
	* `modal/`: Layout and structure components for modals (e.g., `header.ts`, `body.ts`).
* **`src/config/`**: Configuration files, constants, and environment variables.
* **`src/core/`**: Abstract helpers, reusable utilities, and library wrappers (e.g., `sql/connection.ts`, `sql/sql.ts`).
* **`src/services/`**: Integration services, structured with one folder per service.
	* `api/`: API client handlers, structured into thematic folders (mirroring the backend endpoints where possible).
* **`src/styles/`**: Style files, strictly mirroring the folder structure of `src/components/` (e.g., `common/`, `modal/`).
* **`src/views/`**: Web application pages, organized into thematic folders.
* **`src/App.tsx`**: Main application root component.
* **`src/index.tsx`**: Web application entry point.

##### 2. Backend Architecture (Express API)
All backend code lives under the `src/` directory and must follow this layout:

* **`src/core/`**: Abstract helpers, reusable utilities, and library wrappers.
	* `sql/`: Database drivers and connection wrappers (e.g., `connection.ts`, `wrapper.ts`, `sql.ts`).
* **`src/databases/`**: Core database models and queries interaction layer.
	* `sql/schema/`: Database class definitions and Object Models (e.g., `product.ts`, `order.ts`).
	* `sql/queries/`: Raw or structured database query interaction files (e.g., `product.ts`, `order.ts`).
* **`src/routes/`**: API Route controllers, structured into thematic folders.
	* **Rule**: Each file inside a route folder must handle **exactly one single HTTP request** (e.g., `auth/login.ts`).
	* **Rule**: Every folder must contain a `route.ts` file that acts as the router aggregator for that specific domain.
	* `auth/`: Authentication endpoints (e.g., `login.ts`, `route.ts`).
	* `product/`: Product management endpoints.
		* `private/`: Internal/hidden endpoints not exposed to the public API (e.g., `create.ts`).
		* Public endpoints and aggregator (e.g., `get.ts`, `getByType.ts`, `route.ts`).
* **`src/observer/`**: Event listeners, webhooks, or system background functions that cannot be invoked directly by users (e.g., `antenna.webhook.ts`, `route.ts`).

### Visual Basic (VB.NET) Standards
- **Documentation (XML):** Use triple quote comments (`'''`) with `<summary>`, `<param>`, and `<returns>` tags above all method definitions.
- **Case Sensitivity:** Always type keywords matching standard PascalCase capitalization rules (e.g., Public Sub, If...Then) to keep compilation predictable.
- **Naming:** PascalCase for methods, properties, classes, and namespaces; camelCase for variables and parameters.
- **Syntax:** Explicitly use 'ByVal' or 'ByRef' in method definitions. Always include Option Explicit On and Option Strict On at the top of code files unless explicitly instructed otherwise.

### C Standards
- **Documentation (Doxygen):** Every file must start with a `@file` tag. Functions must use `@brief`, `@param`, and `@return`.
- **Semicolons:** Always terminate statements with semicolons (;).
- **Naming:** snake_case for variables, local functions, and struct members; ALL_CAPS for macros and constants.
- **Architecture:** Prefer modular functions with single entry/exit points where applicable. Manage allocations defensively (always free dynamically allocated memory).
