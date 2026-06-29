# `nfse_draft.v1`

`nfse_draft.v1` is the stable file boundary between source invoice importers
and NFS-e artifact generation. It is a YAML or JSON object validated by
`schema/nfse-draft.v1.schema.json`.

The draft is intentionally explicit. `notaflow` copies commercial invoice facts
where it can, but it does not infer fiscal codes, tax treatment, countries,
exchange rates, BRL values, or approved Portuguese service text.

## Top-Level Sections

| Section | Purpose |
| --- | --- |
| `schema_version` | Must be `nfse_draft.v1`. |
| `source_invoice` | Optional source invoice metadata copied during import. |
| `dps` | DPS environment, issuer role, city, numbering, and application metadata. |
| `provider` | Service provider identity and tax regime data. |
| `recipient` | Service recipient identity, address, country, and foreign tax ID data. |
| `amounts` | Original currency amount, BRL amount, and exchange rate evidence data. |
| `payment` | Payment or conversion date and exchange contract reference. |
| `service` | Reviewed service description, service codes, location, and withholding decision. |
| `foreign_trade` | Foreign-trade fields required for export-service DPS data. |
| `tax` | Municipal, federal, result-country, and approximate-tax fields. |
| `evidence` | Supporting evidence metadata and optional local file references. |
| `outputs` | Optional generated artifact paths. |
| `audit` | Creation/update timestamps and human-review notes. |

## Readiness Rules

Schema validation checks structure and basic formats. Readiness validation then
reports whether the draft has enough reviewed data for the helper workflow and
DPS XML generation.

Readiness errors indicate required data is missing. Readiness warnings indicate
data that may not be globally applicable, but should be reviewed and recorded
when available.

Common required values include:

- Recipient name and country.
- Original amount and BRL amount.
- Payment or conversion date.
- Reviewed Portuguese service description.
- Municipal and national service codes.
- ISS withholding decision.
- DPS environment, issue timestamp, series, number, competence date, issuer
  type, and city code.
- Provider CNPJ or CPF and tax regime fields.
- Recipient NIF or `non_nif_reason`.
- Taxation and foreign-trade fields when the draft represents an export-service
  workflow.

## Evidence

Evidence entries are metadata only. `notaflow` does not fetch, parse, upload, or
commit evidence files. Keep evidence files under ignored local directories such
as `evidence/` or `workspace/`.

## Compatibility

Additive draft changes should use a new schema version when they would break
existing files or change DPS/artifact meaning. Importers should normalize source
formats into this draft shape instead of coupling DPS generation to a source
invoice format.
