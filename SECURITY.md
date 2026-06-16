# Security

`notaflow` handles tax and business documents, so local working files can contain
sensitive data.

## Supported Versions

The project is pre-release. Security fixes will be made on `main` until a public
release process exists.

## Reporting A Vulnerability

While the repository is private, report vulnerabilities through a private GitHub
issue or GitHub Security Advisory if available. Do not attach real invoices,
issued NFS-e files, payment confirmations, credentials, or taxpayer identifiers
unless they are strictly required and have been redacted.

## Data Handling Expectations

- Keep private inputs and generated artifacts under ignored directories such as
  `workspace/` and `evidence/`.
- Do not commit PDFs or real XML files.
- Review package contents with `npm run pack:dry-run` before any release.
