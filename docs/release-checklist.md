# Release Checklist

Use this before making the repository public or publishing to npm.

## Before Public GitHub Release

- Confirm no real invoices, issued NFS-e files, payment confirmations, PDFs,
  access keys, taxpayer IDs, or generated `workspace/` artifacts are tracked.
- Run a targeted sensitive-data scan over tracked files.
- Choose a license and add a `LICENSE` file.
- Replace `"license": "UNLICENSED"` in `package.json`.
- Decide whether package imports are supported publicly or whether the package
  should remain CLI-only.
- Review the README for current limitations: unsigned DPS XML, no portal
  automation, no final issued `<NFSe>` generation.
- Confirm CI passes on `main`.

## Before npm Publish

- Remove `"private": true` from `package.json`.
- Confirm `repository`, `bugs`, `homepage`, `exports`, `types`, and `bin` are
  correct.
- Run:

  ```bash
  npm ci
  npm run verify
  npm run pack:dry-run
  ```

- Inspect the dry-run package contents and confirm only intended files are
  included.
- Create a version commit and tag.
- Publish from a clean working tree.
