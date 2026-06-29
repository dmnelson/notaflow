# Public Release Plan

Last reviewed: 2026-06-29.

This plan turns the public-readiness audit into an ordered path for making
`notaflow` public on GitHub and publishing it to npm.

## Release Goal

Make `notaflow` safe and clear for public use as a local CLI and optional ESM
library for preparing Brazilian NFS-e draft artifacts.

The first public release should preserve the current scope:

- Local-only draft preparation.
- Manual portal issuance workflow.
- Unsigned DPS XML generation.
- No portal login, submission, banking, email, OAuth, password, or credential
  integration.
- No final issued `<NFSe>` generation.

## Current State

The tracked repository is small and mostly ready:

- TypeScript source, tests, examples, schema, and maintenance docs are tracked.
- `workspace/`, `node_modules/`, `dist/`, and `.npm-cache/` are ignored.
- `npm run verify` passes.
- `npm run pack:dry-run` produces a package limited to `dist`, `schema`,
  `README.md`, `CHANGELOG.md`, and `package.json`.
- `npm audit` reports no known vulnerabilities.

Phase 1-8 public-release preparation addressed these original blockers:

- `package.json` no longer has `"private": true`.
- `package.json` uses the MIT license.
- A `LICENSE` file is present.
- Public docs describe installation, support, limitations, and package usage.
- Runtime version strings are sourced from package metadata.
- CLI argument parsing reports concise Commander errors.
- CLI behavior is covered by smoke tests.

## Phase 1: Privacy And Repository Hygiene

Goal: make the GitHub repository safe to make public.

Tasks:

- Confirm no private files are tracked:

  ```bash
  git status --short --ignored
  git ls-files
  ```

- Keep `workspace/`, `evidence/`, PDFs, generated XML, generated portal HTML,
  and generated checklists ignored.
- Delete or move local ignored `workspace/` data before changing repository
  visibility or sharing an archive of the repo.
- Scan tracked files for high-risk strings before release:

  ```bash
  rg --hidden -n -S --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' --glob '!workspace/**' \
    '(BEGIN .*PRIVATE KEY|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|ghp_[A-Za-z0-9_]{20,}|github_pat_|sk-[A-Za-z0-9]{20,}|npm_[A-Za-z0-9]{20,}|NPM_TOKEN|AWS_SECRET_ACCESS_KEY|CLIENT_SECRET|PRIVATE_KEY|ACCESS_TOKEN|AUTH_TOKEN)' .
  ```

- Confirm history does not contain private working files:

  ```bash
  git log --all --name-only --pretty=format: | sort -u
  ```

Acceptance criteria:

- No tracked real invoices, issued NFS-e files, payment confirmations, PDFs,
  taxpayer identifiers, credentials, tokens, or generated workspace artifacts.
- Git history does not show `workspace/` or `evidence/` files.
- Any local ignored private data is outside the repo before visibility changes.

## Phase 2: License And Package Metadata

Goal: make package metadata publishable and unambiguous.

Tasks:

- Choose a public license.
- Add `LICENSE`.
- Confirm the MIT license is still the intended public license.
- Confirm `"private": true` is absent from `package.json`.
- Change the repository URL to a public-friendly URL:

  ```json
  "repository": {
    "type": "git",
    "url": "git+https://github.com/dmnelson/notaflow.git"
  }
  ```

- Decide whether the package is officially both CLI and library, or CLI-first
  with best-effort exports.
- Keep `bin`, `main`, `types`, and `exports` aligned with that decision.
- Check the npm name again immediately before publishing:

  ```bash
  npm view notaflow name version description --json
  ```

Acceptance criteria:

- `npm pack --dry-run` does not warn about private or unlicensed metadata.
- The npm package name is available or the package is renamed/scoped.
- Metadata matches the support policy and public API promise.

## Phase 3: Version Handling

Goal: avoid version drift between `package.json`, CLI output, and generated
draft metadata.

Tasks:

- Keep CLI and draft defaults sourced from package metadata.
- Use a single source of truth for package name and version.
- Keep generated draft `dps.application_version` stable and deterministic.
- Update tests to assert the version is sourced from package metadata.

Acceptance criteria:

- `notaflow --version` matches `package.json`.
- New drafts use `notaflow/<package-version>` for `dps.application_version`.
- No source files contain a duplicated release version except fixtures or
  changelog entries.

## Phase 4: Public CLI Quality

Goal: make common user-facing failures clean and testable.

Tasks:

- Replace generic parser throws with Commander argument errors for numeric
  parsing and similar option validation.
- Add CLI smoke tests for:
  - `notaflow --help`
  - `notaflow --version`
  - `notaflow new`
  - `notaflow from-invoice`
  - `notaflow validate`
  - `notaflow summary`
  - `notaflow dps`
  - invalid argument exit behavior
- Assert generated files exist for artifact commands.
- Keep tests isolated under temporary directories.

Acceptance criteria:

- Invalid CLI input prints a concise user-facing error, not a Node stack trace.
- CLI tests run with `npm test`.
- `npm run verify` covers both library and CLI behavior.

## Phase 5: Documentation

Goal: make public users understand install, scope, limitations, and support.

Tasks:

- Rewrite README package status for public release.
- Add public install commands:

  ```bash
  npm install -g notaflow
  notaflow --help
  ```

- Include an `npx` example if supported:

  ```bash
  npx notaflow --help
  ```

- Document the public API if package imports are supported.
- Add or link a concise `nfse_draft.v1` field reference.
- Keep limitations prominent:
  - unsigned DPS XML
  - no signing
  - no portal automation
  - no final issued `<NFSe>` generation
  - no credential handling
- Keep `CONTRIBUTING.md` free of private-release wording.
- Update `SECURITY.md` with a public vulnerability reporting path.
- Update `CHANGELOG.md` before tagging.

Acceptance criteria:

- README no longer tells public users the package is private or unlicensed.
- Public install, usage, limitations, and security reporting paths are clear.
- The existing `docs/release-checklist.md` remains valid as the final release
  gate.

## Phase 6: Third-Party Schema Provenance

Goal: avoid ambiguity around the included national NFS-e and XMLDSig schemas.

Tasks:

- Keep the checked-in `schema/nfse/1.01/*.xsd` files out of the npm package,
  since runtime DPS XSD validation currently comes from `nfse-js`.
- Maintain `docs/schema-provenance.md` for source, version, and license or
  public-origin notes.
- Keep `schema/nfse-draft.v1.schema.json` exported if public consumers should
  validate drafts directly.

Acceptance criteria:

- Every shipped schema file has a clear reason to be in the package.
- Third-party license/provenance notes are present where needed.
- `npm run pack:dry-run` package contents are intentional.

## Phase 7: Dependency And Runtime Policy

Goal: make runtime expectations predictable for public users.

Tasks:

- Keep Node `>=22.12` unless `commander` or another runtime dependency changes.
- Align `@types/node` with the supported runtime baseline, or explicitly test
  newer Node majors if using newer types.
- Run dependency checks:

  ```bash
  npm outdated --long
  npm audit --omit=dev --audit-level=moderate
  npm audit --audit-level=moderate
  ```

- Decide whether to keep the `esbuild` override.

Acceptance criteria:

- Supported Node version is documented and enforced by `engines`.
- Type definitions do not hide accidental dependence on unsupported Node APIs.
- No known moderate-or-higher vulnerabilities before release.

## Phase 8: Final Verification

Goal: make the release reproducible from a clean checkout.

Tasks:

- Start from a clean working tree.
- Reinstall and verify:

  ```bash
  npm ci
  npm run verify
  npm run pack:dry-run
  ```

- Manually inspect package contents from the dry run.
- Smoke test the built CLI:

  ```bash
  node dist/cli.js --help
  node dist/cli.js validate examples/nfse-draft.yml
  node dist/cli.js summary examples/nfse-draft.yml
  ```

- Confirm CI passes on `main`.

Acceptance criteria:

- Local verification and CI are green.
- Package contents contain only intended public files.
- No private workspace data is present in tracked files, history, or package
  contents.

## Phase 9: Release And Publish

Goal: publish a clean, traceable public release.

Tasks:

- Update `CHANGELOG.md`.
- Commit release changes.
- Tag the release:

  ```bash
  git tag v0.1.0
  ```

- Push branch and tag.
- Make the GitHub repository public after privacy checks are complete.
- Publish from a clean working tree:

  ```bash
  npm publish
  ```

- Verify npm install from the published package:

  ```bash
  npm view notaflow version
  npm install -g notaflow
  notaflow --version
  ```

Acceptance criteria:

- GitHub release state matches npm package state.
- Published package installs and runs.
- README, SECURITY, and CHANGELOG match the published version.

## Suggested Work Order

1. Re-run final verification and package inspection.
2. Confirm the npm name immediately before publishing.
3. Commit release changes.
4. Change repository visibility.
5. Tag and publish.

## Final Gate

Run `docs/release-checklist.md` after this plan is complete. Treat any unchecked
item in that checklist as a release blocker.
