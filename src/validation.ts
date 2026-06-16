import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import * as formatsModule from "ajv-formats";
import type { FormatsPlugin } from "ajv-formats";

import { dpsReadinessIssues } from "./dps.js";
import { readDataFile } from "./io.js";
import type { NfseDraft, ReadinessIssue } from "./types.js";

const schemaFile = fileURLToPath(
  new URL("../schema/nfse-draft.v1.schema.json", import.meta.url),
);

export interface DraftValidation {
  draft: NfseDraft | null;
  schemaErrors: string[];
  readiness: ReadinessIssue[];
}

export async function validateDraftFile(file: string): Promise<DraftValidation> {
  const data = await readDataFile(file);
  const schema = JSON.parse(await readFile(schemaFile, "utf8")) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const addFormats = formatsModule.default as unknown as FormatsPlugin;
  addFormats(ajv);
  const validate = ajv.compile(schema);

  if (!validate(data)) {
    return {
      draft: null,
      schemaErrors: (validate.errors ?? []).map(formatSchemaError),
      readiness: [],
    };
  }

  const draft = data as unknown as NfseDraft;
  return {
    draft,
    schemaErrors: [],
    readiness: readinessIssues(draft),
  };
}

export async function loadDraft(file: string): Promise<NfseDraft> {
  const result = await validateDraftFile(file);
  if (!result.draft) {
    throw new Error(
      `Invalid NFS-e draft structure:\n${result.schemaErrors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }
  return result.draft;
}

export function readinessIssues(draft: NfseDraft): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  required(issues, "recipient.name", draft.recipient.name, "recipient name");
  required(
    issues,
    "recipient.country_code",
    draft.recipient.country_code,
    "2-letter recipient country code",
  );
  required(
    issues,
    "recipient.country_name_pt",
    draft.recipient.country_name_pt,
    "recipient country name in Portuguese",
  );
  required(
    issues,
    "amounts.original_currency",
    draft.amounts.original_currency,
    "original currency",
  );
  required(
    issues,
    "amounts.original_amount",
    draft.amounts.original_amount,
    "original invoice/payment amount",
  );
  required(
    issues,
    "amounts.brl_amount",
    draft.amounts.brl_amount,
    "BRL amount from the payment/conversion evidence",
  );
  required(issues, "payment.date", draft.payment.date, "payment/conversion date");
  required(
    issues,
    "service.description_pt",
    draft.service.description_pt,
    "reviewed Portuguese service description",
  );
  required(
    issues,
    "service.municipal_service_code",
    draft.service.municipal_service_code,
    "municipal service code",
  );
  required(
    issues,
    "service.national_service_code",
    draft.service.national_service_code,
    "national service code",
  );
  required(
    issues,
    "service.iss_withheld",
    draft.service.iss_withheld,
    "ISS withholding decision",
  );

  if (!draft.recipient.foreign_tax_id) {
    issues.push({
      severity: "warning",
      path: "recipient.foreign_tax_id",
      message: "confirm whether the foreign recipient tax ID is available",
    });
  }
  if (!draft.amounts.exchange_rate_to_brl) {
    issues.push({
      severity: "warning",
      path: "amounts.exchange_rate_to_brl",
      message: "record the effective exchange rate when available",
    });
  }
  if (!draft.payment.exchange_contract_number) {
    issues.push({
      severity: "warning",
      path: "payment.exchange_contract_number",
      message: "record the exchange contract number when applicable",
    });
  }
  if (!draft.evidence.some((entry) => entry.local_file)) {
    issues.push({
      severity: "warning",
      path: "evidence",
      message: "no local evidence file is referenced",
    });
  }

  return dedupeIssues([...issues, ...dpsReadinessIssues(draft)]);
}

function required(
  issues: ReadinessIssue[],
  path: string,
  value: unknown,
  description: string,
): void {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    issues.push({
      severity: "error",
      path,
      message: `missing ${description}`,
    });
  }
}

function formatSchemaError(error: ErrorObject): string {
  const location = error.instancePath || "/";
  return `${location}: ${error.message ?? "invalid value"}`;
}

function dedupeIssues(issues: ReadinessIssue[]): ReadinessIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.severity}:${issue.path}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
