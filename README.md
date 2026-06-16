# notaflow

`notaflow` is a local TypeScript/Node.js CLI for preparing auditable Brazilian
NFS-e drafts and copy/paste artifacts for manual issuance through
[nfse.gov.br](https://www.nfse.gov.br/).

The core file format is `nfse_draft.v1`. Source importers are optional adapters:

```text
standalone input or supported invoice source
              |
              v
        nfse_draft.v1 YAML
              |
              +--> validate
              +--> summary
              +--> unsigned DPS XML
              +--> portal HTML
              +--> Markdown checklist
```

After a draft is created, every command reads only the draft. The DPS XML,
portal helper, checklist, and validation pipeline do not depend on any invoice
project or private source format.

## What It Does

- Creates a versioned `nfse_draft.v1` YAML file from scratch.
- Imports supported commercial invoice formats into the same draft contract.
- Keeps payment, conversion, Portuguese service text, fiscal codes, and evidence
  explicit.
- Validates both JSON Schema structure and issuance readiness.
- Generates unsigned DPS XML with `nfse-js` and validates it against the
  national v1.01 XSD before writing the file.
- Generates a local HTML copy/paste helper and a Markdown review checklist.

## What It Does Not Do

- It does not mutate source invoice files.
- It does not infer recipient country or fiscal codes from address text.
- It does not translate a commercial description and treat it as approved tax
  text.
- It does not assume invoice date, payment date, conversion date, or BRL amount
  are interchangeable.
- It has no email, banking portal, nfse.gov.br login, credential, OAuth, or
  password integration.
- It does not submit or issue an NFS-e.
- It does not sign DPS XML yet.
- It does not generate the final issued `<NFSe>` document. The official NFS-e
  wraps the DPS and is produced by the national system after processing.

## Requirements

- Node.js 20 or newer

## Setup

```bash
npm install
npm run verify
npm link
```

`npm link` makes the `notaflow` command available in the current Node
environment. Commands can also be run as `node dist/cli.js ...` after building.

## Standalone Draft

Use `new` when there is no supported invoice source, or when another tool will
write the draft directly.

```bash
notaflow new workspace/manual/nfse-draft.yml \
  --recipient-name "Example Client Ltd" \
  --country-code GB \
  --country-name-pt "Reino Unido" \
  --currency USD \
  --amount 7000
```

This produces an `nfse_draft.v1` file with `source_invoice: null`. Missing
values remain `null`; `notaflow` does not invent fiscal data.

## Invoice Importers

`from-invoice` is an adapter entrypoint. It reads a supported invoice source,
normalizes commercial facts into `nfse_draft.v1`, and then stops depending on
the source file.

```bash
notaflow from-invoice examples/invoice.yml \
  --invoice-format simple-invoice.v1 \
  --out workspace/example/nfse-draft.yml \
  --country-code GB \
  --country-name-pt "Reino Unido"
```

`notaflow init` is an alias for `notaflow from-invoice`.

### `simple-invoice.v1`

The included importer supports the specific YAML/JSON invoice shape used by the
companion local invoice project. It is not a general invoice standard.

The example at [`examples/invoice.yml`](examples/invoice.yml) demonstrates this
format. The importer recognizes:

- `invoice_number`, `kind`, `issue_date`
- `period_start`, `period_end`
- `currency`
- `client` or `client_ref`
- `line_items[].description`, `quantity`, `unit_amount`
- `expenses[].amount`

When an invoice uses `client_ref`, a file under `<workspace>/invoices/` resolves
`<workspace>/clients/<client_ref>.yml` automatically. For invoices stored
elsewhere, provide the workspace explicitly:

```bash
notaflow from-invoice invoice.yml \
  --invoice-format simple-invoice.v1 \
  --invoice-workspace path/to/invoice-workspace \
  --out workspace/nfse-draft.yml
```

Files without `schema_version` can still auto-detect as `simple-invoice.v1` when
they match the required fields. The generated draft records the source format as
`simple-invoice.v1`.

## Extending Input Formats

`nfse_draft.v1` is the stable boundary. New ingestion formats should normalize
their input into the internal `ImportedInvoice` shape and leave all NFS-e fields
for the draft/review step.

To add another invoice format:

1. Add an `InvoiceImporter` implementation in [`src/invoice.ts`](src/invoice.ts).
2. Give it a stable `id`, such as `my-system.v1`.
3. Implement `detect` conservatively so auto-detection does not misread other
   formats.
4. Normalize only commercial facts: invoice number, period, currency, total,
   descriptions, recipient name, and non-fiscal address lines.
5. Register it in `invoiceImporters`.
6. Add focused tests in [`tests/invoice.test.ts`](tests/invoice.test.ts).

Runtime plugin loading is not implemented yet. For now, extension means adding a
small source adapter to the package while keeping the canonical draft and DPS
generation unchanged.

## Complete And Validate

Edit the generated YAML with reviewed payment, conversion, service, fiscal, and
evidence values.

The fields under `dps`, `provider`, `service`, `foreign_trade`, and `tax` map to
the national DPS layout through `nfse-js`. For export services where the service
location remains the Brazilian city of issuance, set the city under
`service.location_city_code` and the country where the service result occurred
under `tax.result_country_code`.

```bash
notaflow validate workspace/example/nfse-draft.yml
```

Validation has two layers:

1. JSON Schema validation checks the versioned file structure, types, dates, and
   unknown fields.
2. Readiness checks report missing values required by the helper workflow.

An incomplete draft exits with status 1. During initial preparation, use
`--allow-incomplete` to inspect issues without a failing status:

```bash
notaflow validate workspace/example/nfse-draft.yml --allow-incomplete
```

Foreign tax ID, effective exchange rate, exchange contract number, and local
evidence are warnings because their applicability/availability must be reviewed,
not assumed globally.

## Generate Artifacts

```bash
notaflow summary workspace/example/nfse-draft.yml

notaflow dps workspace/example/nfse-draft.yml \
  --out workspace/example/dps.xml

notaflow portal workspace/example/nfse-draft.yml \
  --out workspace/example/nfse-portal.html

notaflow checklist workspace/example/nfse-draft.yml \
  --out workspace/example/nfse-checklist.md
```

The `dps` command builds a DPS object with `nfse-js`, runs the library's
semantic validator, serializes XML, and then validates the XML against the
national DPS XSD. The HTML is self-contained, works locally, orders fields into
practical groups, and gives every populated field a copy button. It prominently
reports missing readiness fields. It does not connect to or automate the NFS-e
portal.

## Evidence

Evidence is generic metadata plus an optional local file reference:

```yaml
evidence:
  - type: payment_confirmation
    source: bank_portal
    reference: Payment confirmation 123
    date: "2026-06-10"
    local_file: evidence/2026-06/payment-confirmation-123.pdf
    extracted_with: manual review
    notes: null
```

The application does not fetch evidence. A person or an external process may
collect supporting files and update the YAML. `evidence/`, PDFs, and generated
workspace artifacts are ignored by Git by default.

## Project Structure

```text
src/        CLI, invoice importers, draft model, DPS XML, validation, artifacts
schema/     versioned JSON Schema
tests/      Node test runner coverage
examples/   fake simple-invoice source and completed NFS-e draft
workspace/  ignored private drafts and generated files
evidence/   ignored supporting files
```

See [`examples/invoice.yml`](examples/invoice.yml) and
[`examples/nfse-draft.yml`](examples/nfse-draft.yml).
