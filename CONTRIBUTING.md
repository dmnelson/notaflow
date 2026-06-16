# Contributing

`notaflow` is currently private and pre-release. Keep changes small, auditable,
and covered by focused tests.

## Development

```bash
npm ci
npm run verify
```

Useful commands:

```bash
npm run typecheck
npm test
npm run build
npm run pack:dry-run
```

## Rules For Changes

- Do not commit real invoices, issued NFS-e files, payment confirmations, PDFs,
  or generated `workspace/` artifacts.
- Keep `nfse_draft.v1` as the boundary between input adapters and DPS/artifact
  generation.
- Add a focused test when changing validation, DPS mapping, importer behavior,
  or generated artifact content.
- Treat NFS-e fiscal values as reviewed data. Do not infer tax codes, countries,
  service text, or BRL conversion values from unrelated fields.
- Update `README.md` and `CHANGELOG.md` when changing user-visible behavior.

## Adding An Invoice Importer

1. Add an `InvoiceImporter` implementation in `src/invoice.ts`.
2. Give it a stable id such as `my-system.v1`.
3. Keep `detect` conservative.
4. Normalize only commercial facts into `ImportedInvoice`.
5. Leave NFS-e-specific fields for the draft/review step.
6. Add tests in `tests/invoice.test.ts`.
