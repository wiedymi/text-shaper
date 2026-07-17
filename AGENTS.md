# Repository Guidelines

## Project Overview

`text-shaper` is a TypeScript text-shaping and font-rasterization library inspired by rustybuzz, HarfBuzz, FreeType, and libass. Keep shaping behavior deterministic, preserve malformed-font safety, and avoid unnecessary allocation in hot paths.

## Repository Structure

- `src/index.ts`: public package exports.
- `src/font/`: sfnt loading, binary readers, WOFF/WOFF2 support, and OpenType/AAT table parsers.
- `src/buffer/`: reusable Unicode and glyph buffers.
- `src/layout/`: GSUB/GPOS structures and lookup processing.
- `src/shaper/`: shaping pipeline and script-specific shapers.
- `src/aat/`: AAT state-machine processing.
- `src/unicode/`: script, bidi, and grapheme data and algorithms.
- `src/raster/`, `src/hinting/`, and `src/render/`: outline interpretation, rasterization, and rendering helpers.
- `tests/`: Bun tests; portable fixtures live under `tests/fixtures/` and `tests/fonts/`.
- `reference/`: upstream/reference implementations and fonts. Treat these as read-only unless a task explicitly targets them.
- `docs/`: VitePress documentation.
- `dist/`: generated package output; do not edit or commit it.

## Tooling and Commands

Use Bun and the scripts already defined in `package.json`. Do not replace repository tooling merely to satisfy a generic preference.

- `bun install --frozen-lockfile`: install the locked dependencies.
- `bun test <test-file>`: run focused tests.
- `bun test`: run the complete suite.
- `bun run typecheck`: run TypeScript without emitting files.
- `bunx biome check <changed-files>`: perform a non-mutating style check on changed source files.
- `bun run lint`: apply Biome's configured safe/unsafe fixes; use it only when formatting changes are intended.
- `bun run build:prod`: build the production JavaScript package.
- `bun run build:dts`: emit package declarations.
- `bun run docs:build`: build the VitePress documentation.

VitePress is part of this repository's supported documentation toolchain. The presence of Bun does not imply that existing Vite-based tooling should be removed.

## Coding Conventions

- TypeScript ESM with explicit `.ts` imports in source.
- Tabs for indentation, double quotes for strings, semicolons, and trailing commas, as configured by Biome.
- Kebab-case file names and camelCase functions/variables; use PascalCase for exported types and classes.
- Keep additions to `src/index.ts` intentional so the public API remains stable.
- Prefer reusable buffers and zero-copy reads in shaping and rasterization hot paths.
- Preserve lazy font-table parsing and caching behavior.

## Font Parsing and Shaping Rules

- All sfnt/OpenType numeric data is big-endian.
- Resolve offsets against the table-specific base defined by the relevant specification; do not assume every offset is relative to the current reader position.
- Bound `Reader` slices to the owning table or subtable. A malformed font must not read into an adjacent binary region.
- Validate counts, indices, state transitions, action stacks, and lookup results before mutating glyph output.
- Preserve cluster mapping when glyphs are substituted, merged, reordered, or removed.
- Compare uncertain OpenType/AAT behavior with primary specifications and production implementations such as HarfBuzz or rustybuzz.

## Testing and Validation

For fixes, reproduce the failure first, add a regression that fails for the demonstrated reason, then implement the correction.

- Prefer portable synthetic tests for parser and state-machine edge cases.
- Add real-font integration coverage when a redistributable fixture exists.
- Many legacy tests reference fonts under `/System/Library/Fonts`. On non-macOS systems, distinguish missing-font failures from product regressions and report the limitation; do not weaken assertions simply to make platform-specific tests pass.
- Run focused tests while iterating, then typecheck, production build, declaration build, and the broadest relevant suite before publishing.
- Clean up temporary probes and generated artifacts after validation.

## Commits, Pull Requests, and Releases

- Keep commits focused and use the repository's existing prefixes, such as `fix:`, `feat:`, `test:`, and `chore:`.
- Pull requests should explain the root cause, behavioral impact, tests added, and validation performed.
- Publishing is handled by `.github/workflows/publish.yml` with an explicit version input. The workflow publishes to npm and commits the resulting `package.json` version bump to `main`.
- Do not publish, dispatch workflows, push tags, or change versions unless the user explicitly requests a release.
