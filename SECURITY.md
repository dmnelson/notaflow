# Security

`notaflow` handles tax and business documents, so local working files can contain
sensitive data.

## Supported Versions

Security fixes are made on `main` for the latest published version.

## Reporting A Vulnerability

Report vulnerabilities through a GitHub Security Advisory when available, or by
opening a GitHub issue that does not include sensitive details. Do not attach
real invoices, issued NFS-e files, payment confirmations, credentials, or
taxpayer identifiers unless they are strictly required and have been redacted.

If a report requires private details, ask for a private disclosure channel in
the initial issue.

## Data Handling Expectations

- Keep private inputs and generated artifacts under ignored directories such as
  `workspace/` and `evidence/`.
- Do not commit PDFs or real XML files.
- Review package contents with `npm run pack:dry-run` before any release.
