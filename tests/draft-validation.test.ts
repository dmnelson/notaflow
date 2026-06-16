import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { draftFromInvoice, newStandaloneDraft } from "../src/draft.js";
import { writeDraft } from "../src/io.js";
import { validateDraftFile } from "../src/validation.js";

test("creates an invoice-backed draft without inventing fiscal values", () => {
  const draft = draftFromInvoice(
    {
      format: "simple-invoice.v1",
      file: "../source-invoices/2026-06.yml",
      invoiceNumber: "INV-202606",
      kind: "standard",
      issueDate: "2026-06-30",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      currency: "USD",
      total: 7000,
      descriptions: ["R&D and software engineering services"],
      recipientName: "Example Client Ltd",
      recipientAddress: ["England"],
    },
    {},
    new Date("2026-06-11T12:00:00.000Z"),
  );

  assert.equal(draft.amounts.original_amount, 7000);
  assert.equal(draft.amounts.brl_amount, null);
  assert.equal(draft.payment.date, null);
  assert.equal(draft.recipient.country_code, null);
  assert.equal(draft.service.description_pt, null);
  assert.equal(draft.service.iss_withheld, null);
});

test("creates a standalone draft with the same contract", () => {
  const draft = newStandaloneDraft(
    {
      recipientName: "Example Client",
      originalCurrency: "EUR",
      originalAmount: 1000,
    },
    new Date("2026-06-11T12:00:00.000Z"),
  );

  assert.equal(draft.source_invoice, null);
  assert.equal(draft.recipient.name, "Example Client");
  assert.equal(draft.amounts.original_currency, "EUR");
  assert.equal(draft.amounts.original_amount, 1000);
});

test("schema accepts a draft while readiness reports missing issuance fields", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "notaflow-draft-"));
  const draftFile = path.join(directory, "draft.yml");
  await writeDraft(
    draftFile,
    newStandaloneDraft({}, new Date("2026-06-11T12:00:00.000Z")),
  );

  const result = await validateDraftFile(draftFile);

  assert.deepEqual(result.schemaErrors, []);
  assert.ok(result.draft);
  assert.ok(
    result.readiness.some(
      (issue) =>
        issue.severity === "error" && issue.path === "amounts.brl_amount",
    ),
  );
  assert.ok(
    result.readiness.some(
      (issue) =>
        issue.severity === "error" && issue.path === "service.iss_withheld",
    ),
  );
});

test("a filled draft has no readiness errors", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "notaflow-ready-"));
  const draftFile = path.join(directory, "draft.yml");
  const draft = newStandaloneDraft(
    {
      recipientName: "Example Client",
      countryCode: "GB",
      countryNamePt: "Reino Unido",
      originalCurrency: "USD",
      originalAmount: 7000,
      serviceDescriptionPt:
        "Prestação de serviços de desenvolvimento de software.",
    },
    new Date("2026-06-11T12:00:00.000Z"),
  );
  draft.amounts.brl_amount = 49000;
  draft.amounts.exchange_rate_to_brl = 7;
  draft.dps.environment = "2";
  draft.dps.issued_at = "2026-06-11T12:00:00.000Z";
  draft.dps.series = "70000";
  draft.dps.number = "1";
  draft.dps.competency_date = "2026-06-10";
  draft.dps.city_code = "3106200";
  draft.provider.cnpj = "12345678000195";
  draft.provider.municipal_registration = "12345678901";
  draft.provider.tax_regime.simples_nacional_status = "3";
  draft.provider.tax_regime.simples_nacional_assessment = "1";
  draft.provider.tax_regime.special_tax_regime = "0";
  draft.recipient.foreign_tax_id = "GB123456789";
  draft.payment.date = "2026-06-10";
  draft.payment.exchange_contract_number = "EXAMPLE-123";
  draft.service.municipal_service_code = "001";
  draft.service.national_service_code = "010101";
  draft.service.nbs_code = "115080000";
  draft.service.location_city_code = "3106200";
  draft.service.iss_withheld = false;
  draft.foreign_trade.service_mode = "4";
  draft.foreign_trade.relationship = "0";
  draft.foreign_trade.currency_code = "220";
  draft.foreign_trade.provider_support = "01";
  draft.foreign_trade.customer_support = "01";
  draft.foreign_trade.temporary_goods_movement = "1";
  draft.foreign_trade.mdic_registration = "0";
  draft.tax.municipal_taxation = "3";
  draft.tax.iss_withholding = "1";
  draft.tax.result_country_code = "GB";
  draft.tax.pis_cofins_cst = "00";
  draft.tax.total_tax.disclosure_indicator = null;
  draft.tax.total_tax.simples_nacional_rate = 6;
  const evidence = draft.evidence[0];
  assert.ok(evidence);
  evidence.local_file = "evidence/example.pdf";

  await writeDraft(draftFile, draft);
  const result = await validateDraftFile(draftFile);

  assert.deepEqual(result.schemaErrors, []);
  assert.equal(
    result.readiness.filter((issue) => issue.severity === "error").length,
    0,
  );
});
