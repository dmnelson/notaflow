import assert from "node:assert/strict";
import test from "node:test";

import {
  APPLICATION_VERSION,
  listInvoiceImporters,
  newStandaloneDraft,
  PACKAGE_NAME,
  PACKAGE_VERSION,
  SCHEMA_VERSION,
} from "../src/index.js";

test("public API exposes the draft contract and importer registry", () => {
  const draft = newStandaloneDraft(
    {
      recipientName: "Example Client",
      originalCurrency: "USD",
      originalAmount: 7000,
    },
    new Date("2026-06-11T12:00:00.000Z"),
  );

  assert.equal(SCHEMA_VERSION, "nfse_draft.v1");
  assert.equal(PACKAGE_NAME, "notaflow");
  assert.match(PACKAGE_VERSION, /^\d+\.\d+\.\d+/);
  assert.equal(APPLICATION_VERSION, `${PACKAGE_NAME}/${PACKAGE_VERSION}`);
  assert.equal(draft.schema_version, SCHEMA_VERSION);
  assert.equal(draft.dps.application_version, APPLICATION_VERSION);
  assert.deepEqual(
    listInvoiceImporters().map((importer) => importer.id),
    ["simple-invoice.v1"],
  );
});
