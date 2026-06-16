import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { importInvoice, listInvoiceImporters } from "../src/invoice.js";

test("imports the simple-invoice shape and calculates totals", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "notaflow-invoice-"));
  const invoiceFile = path.join(directory, "2026-06.yml");
  await writeFile(
    invoiceFile,
    `invoice_number: INV-202606
kind: standard
issue_date: "2026-06-30"
due_date: "2026-07-14"
period_start: "2026-06-01"
period_end: "2026-06-30"
currency: USD
client:
  name: Example Client Ltd
  address:
    - 9 Example Park
    - Wallingford, England
line_items:
  - description: R&D and software engineering services
    quantity: "1.5"
    unit_amount: "100.10"
expenses:
  - date: "2026-06-15"
    description: Reimbursable expense
    amount: "10.25"
`,
    "utf8",
  );

  const invoice = await importInvoice(invoiceFile);

  assert.equal(invoice.invoiceNumber, "INV-202606");
  assert.equal(invoice.total, 160.4);
  assert.equal(invoice.recipientName, "Example Client Ltd");
  assert.deepEqual(invoice.recipientAddress, [
    "9 Example Park",
    "Wallingford, England",
  ]);
  assert.deepEqual(invoice.descriptions, [
    "R&D and software engineering services",
  ]);
});

test("lists simple-invoice as an explicit invoice importer", () => {
  assert.deepEqual(
    listInvoiceImporters().map((importer) => importer.id),
    ["simple-invoice.v1"],
  );
});

test("can select the simple-invoice importer explicitly", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "notaflow-format-"));
  const invoiceFile = path.join(directory, "invoice.yml");
  await writeFile(
    invoiceFile,
    `invoice_number: INV-202606
kind: standard
issue_date: "2026-06-30"
period_start: "2026-06-01"
period_end: "2026-06-30"
currency: USD
client:
  name: Example Client Ltd
line_items:
  - description: Software engineering services
    quantity: "1"
    unit_amount: "7000.00"
`,
    "utf8",
  );

  const invoice = await importInvoice(invoiceFile, {
    format: "simple-invoice.v1",
  });

  assert.equal(invoice.format, "simple-invoice.v1");
  assert.equal(invoice.total, 7000);
});

test("accepts the former local-invoices format id as a compatibility alias", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "notaflow-alias-"));
  const invoiceFile = path.join(directory, "invoice.yml");
  await writeFile(
    invoiceFile,
    `schema_version: local-invoices.v1
invoice_number: INV-202606
kind: standard
issue_date: "2026-06-30"
period_start: "2026-06-01"
period_end: "2026-06-30"
currency: USD
client:
  name: Example Client Ltd
line_items:
  - description: Software engineering services
    quantity: "1"
    unit_amount: "7000.00"
`,
    "utf8",
  );

  const invoice = await importInvoice(invoiceFile);

  assert.equal(invoice.format, "simple-invoice.v1");
  assert.equal(invoice.total, 7000);
});

test("reports unsupported invoice formats clearly", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "notaflow-unknown-"));
  const invoiceFile = path.join(directory, "invoice.yml");
  await writeFile(invoiceFile, "schema_version: other.v1\n", "utf8");

  await assert.rejects(
    () => importInvoice(invoiceFile),
    /no invoice importer matched.*simple-invoice\.v1/,
  );
  await assert.rejects(
    () => importInvoice(invoiceFile, { format: "other.v1" }),
    /Unknown invoice format "other\.v1".*simple-invoice\.v1/,
  );
});

test("resolves client_ref using the inferred invoice workspace", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "notaflow-profile-"));
  const invoiceDirectory = path.join(directory, "invoices");
  const clientDirectory = path.join(directory, "clients");
  await mkdir(invoiceDirectory);
  await mkdir(clientDirectory);
  await writeFile(
    path.join(clientDirectory, "globex.yml"),
    "name: Globex Ltd\naddress:\n  - London, England\n",
    "utf8",
  );
  const invoiceFile = path.join(invoiceDirectory, "2026-06.yml");
  await writeFile(
    invoiceFile,
    `invoice_number: INV-202606
kind: standard
client_ref: globex
issue_date: "2026-06-30"
due_date: "2026-07-14"
period_start: "2026-06-01"
period_end: "2026-06-30"
currency: GBP
line_items:
  - description: Software engineering services
    quantity: "1"
    unit_amount: "7000.00"
`,
    "utf8",
  );

  const invoice = await importInvoice(invoiceFile);

  assert.equal(invoice.recipientName, "Globex Ltd");
  assert.deepEqual(invoice.recipientAddress, ["London, England"]);
});

test("does not infer fiscal country data from an address", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "notaflow-country-"));
  const invoiceFile = path.join(directory, "invoice.json");
  await writeFile(
    invoiceFile,
    JSON.stringify({
      invoice_number: "INV-1",
      issue_date: "2026-06-30",
      period_start: "2026-06-01",
      period_end: "2026-06-30",
      currency: "GBP",
      client: { name: "Client", address: ["London, United Kingdom"] },
      line_items: [
        { description: "Engineering", quantity: "1", unit_amount: "1.00" },
      ],
    }),
    "utf8",
  );

  const invoice = await importInvoice(invoiceFile);

  assert.equal(invoice.recipientName, "Client");
  assert.equal("countryCode" in invoice, false);
});
