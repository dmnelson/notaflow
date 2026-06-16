import path from "node:path";
import { Decimal } from "decimal.js";

import { isRecord, optionalString, readDataFile, stringArray } from "./io.js";
import type { UnknownRecord } from "./types.js";

export interface ImportedInvoice {
  format: string;
  file: string;
  invoiceNumber: string;
  kind: string | null;
  issueDate: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  total: number;
  descriptions: string[];
  recipientName: string | null;
  recipientAddress: string[];
}

export interface ImportInvoiceOptions {
  invoiceWorkspace?: string;
  draftFile?: string;
  format?: string;
}

export interface InvoiceImporter {
  id: string;
  aliases?: string[];
  description: string;
  detect(data: UnknownRecord, invoiceFile: string): boolean;
  import(
    data: UnknownRecord,
    invoiceFile: string,
    options: ImportInvoiceOptions,
  ): Promise<ImportedInvoice>;
}

export async function importInvoice(
  invoiceFile: string,
  options: ImportInvoiceOptions = {},
): Promise<ImportedInvoice> {
  const data = await readDataFile(invoiceFile);
  const importer = selectInvoiceImporter(data, invoiceFile, options.format);
  return importer.import(data, invoiceFile, options);
}

export function listInvoiceImporters(): readonly InvoiceImporter[] {
  return invoiceImporters;
}

const simpleInvoiceImporter: InvoiceImporter = {
  id: "simple-invoice.v1",
  aliases: ["local-invoices.v1"],
  description:
    "YAML/JSON invoices with invoice_number, period dates, line_items, and optional client_ref.",
  detect(data) {
    const schemaVersion = optionalString(data.schema_version);
    if (schemaVersion) return isImporterFormat(simpleInvoiceImporter, schemaVersion);
    return (
      optionalString(data.invoice_number) !== null &&
      optionalString(data.issue_date) !== null &&
      optionalString(data.period_start) !== null &&
      optionalString(data.period_end) !== null &&
      optionalString(data.currency) !== null &&
      Array.isArray(data.line_items)
    );
  },
  import: importSimpleInvoice,
};

const invoiceImporters = [simpleInvoiceImporter] as const;

function selectInvoiceImporter(
  data: UnknownRecord,
  invoiceFile: string,
  requestedFormat?: string,
): InvoiceImporter {
  if (requestedFormat && requestedFormat !== "auto") {
    const importer = invoiceImporters.find(
      (candidate) => isImporterFormat(candidate, requestedFormat),
    );
    if (!importer) {
      throw new Error(
        `Unknown invoice format "${requestedFormat}". Supported formats: ${supportedFormatList()}`,
      );
    }
    return importer;
  }

  const matches = invoiceImporters.filter((importer) =>
    importer.detect(data, invoiceFile),
  );
  if (matches.length === 1) return matches[0] as InvoiceImporter;
  if (matches.length > 1) {
    throw new Error(
      `${invoiceFile}: multiple invoice importers matched (${matches
        .map((importer) => importer.id)
        .join(", ")}). Pass --invoice-format to choose one.`,
    );
  }
  throw new Error(
    `${invoiceFile}: no invoice importer matched. Supported formats: ${supportedFormatList()}`,
  );
}

function supportedFormatList(): string {
  return invoiceImporters.map((importer) => importer.id).join(", ");
}

function isImporterFormat(importer: InvoiceImporter, format: string): boolean {
  return importer.id === format || (importer.aliases ?? []).includes(format);
}

async function importSimpleInvoice(
  data: UnknownRecord,
  invoiceFile: string,
  options: ImportInvoiceOptions,
): Promise<ImportedInvoice> {
  const invoiceNumber = requiredString(data, "invoice_number", invoiceFile);
  const issueDate = requiredString(data, "issue_date", invoiceFile);
  const periodStart = requiredString(data, "period_start", invoiceFile);
  const periodEnd = requiredString(data, "period_end", invoiceFile);
  const currency = requiredString(data, "currency", invoiceFile);
  const lineItems = requiredRecordArray(data, "line_items", invoiceFile);
  const expenses = optionalRecordArray(data.expenses, "expenses", invoiceFile);

  if (lineItems.length === 0) {
    throw new Error(`${invoiceFile}: line_items must contain at least one item`);
  }

  const descriptions = lineItems.map((item, index) =>
    requiredString(item, "description", `${invoiceFile}: line_items[${index}]`),
  );
  const lineTotal = lineItems.reduce((total, item, index) => {
    const quantity = decimalField(
      item.quantity ?? "1",
      `${invoiceFile}: line_items[${index}].quantity`,
    );
    const unitAmount = decimalField(
      item.unit_amount,
      `${invoiceFile}: line_items[${index}].unit_amount`,
    );
    return total.plus(quantity.times(unitAmount));
  }, new Decimal(0));
  const expenseTotal = expenses.reduce(
    (total, expense, index) =>
      total.plus(
        decimalField(expense.amount, `${invoiceFile}: expenses[${index}].amount`),
      ),
    new Decimal(0),
  );

  const client = await resolveClient(data, invoiceFile, options.invoiceWorkspace);
  const relativeFrom = options.draftFile
    ? path.dirname(path.resolve(options.draftFile))
    : process.cwd();
  const relativeFile = path.relative(relativeFrom, path.resolve(invoiceFile));

  return {
    format: "simple-invoice.v1",
    file: relativeFile === "" ? path.basename(invoiceFile) : relativeFile,
    invoiceNumber,
    kind: optionalString(data.kind),
    issueDate,
    periodStart,
    periodEnd,
    currency,
    total: lineTotal.plus(expenseTotal).toDecimalPlaces(2).toNumber(),
    descriptions,
    recipientName: client ? optionalString(client.name) : null,
    recipientAddress: client ? stringArray(client.address) : [],
  };
}

async function resolveClient(
  invoice: UnknownRecord,
  invoiceFile: string,
  invoiceWorkspace?: string,
): Promise<UnknownRecord | null> {
  if (isRecord(invoice.client)) {
    return invoice.client;
  }

  const clientRef = optionalString(invoice.client_ref);
  if (!clientRef) {
    return null;
  }

  const workspace = invoiceWorkspace
    ? path.resolve(invoiceWorkspace)
    : inferInvoiceWorkspace(invoiceFile);
  const clientFile = path.join(workspace, "clients", `${clientRef}.yml`);

  try {
    return await readDataFile(clientFile);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not resolve client_ref "${clientRef}" from ${clientFile}: ${reason}`,
    );
  }
}

function inferInvoiceWorkspace(invoiceFile: string): string {
  const invoiceDirectory = path.dirname(path.resolve(invoiceFile));
  if (path.basename(invoiceDirectory) === "invoices") {
    return path.dirname(invoiceDirectory);
  }
  return path.resolve("workspace");
}

function requiredString(
  record: UnknownRecord,
  key: string,
  context: string,
): string {
  const value = optionalString(record[key]);
  if (!value) {
    throw new Error(`${context}: ${key} must be a non-empty string`);
  }
  return value;
}

function requiredRecordArray(
  record: UnknownRecord,
  key: string,
  context: string,
): UnknownRecord[] {
  return optionalRecordArray(record[key], key, context, true);
}

function optionalRecordArray(
  value: unknown,
  key: string,
  context: string,
  required = false,
): UnknownRecord[] {
  if (value === undefined && !required) {
    return [];
  }
  if (!Array.isArray(value) || value.some((entry) => !isRecord(entry))) {
    throw new Error(`${context}: ${key} must be an array of objects`);
  }
  return value as UnknownRecord[];
}

function decimalField(value: unknown, context: string): Decimal {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`${context} must be a decimal number`);
  }
  try {
    const decimal = new Decimal(value);
    if (!decimal.isFinite() || decimal.isNegative()) {
      throw new Error("not a finite non-negative number");
    }
    return decimal;
  } catch {
    throw new Error(`${context} must be a non-negative decimal number`);
  }
}
