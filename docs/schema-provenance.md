# Schema Provenance

`notaflow` ships the public `nfse_draft.v1` JSON Schema in the npm package:

- `schema/nfse-draft.v1.schema.json`

The repository also keeps a mirror of selected national NFS-e v1.01 XSD files
under `schema/nfse/1.01/` for reference and compatibility investigation. Those
XSD files are not included in the npm package. Runtime DPS XML validation is
performed through the `nfse-js` dependency.

The mirrored national NFS-e schemas use the namespace
`http://www.sped.fazenda.gov.br/nfse` and should be treated as third-party
reference material from the Brazilian national NFS-e specification.

The mirrored XML Digital Signature schema,
`schema/nfse/1.01/xmldsig-core-schema.xsd`, includes its own W3C copyright and
license notice in the file header.

Before shipping any additional third-party schema file in the npm package,
record its source, version, and license or public-origin note here.
