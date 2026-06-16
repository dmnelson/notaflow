import type { ImportedInvoice } from "./invoice.js";
import { SCHEMA_VERSION, type NfseDraft } from "./types.js";

export interface DraftOverrides {
  recipientName?: string;
  countryCode?: string;
  countryNamePt?: string;
  foreignTaxId?: string;
  originalCurrency?: string;
  originalAmount?: number;
  serviceDescriptionPt?: string;
}

export function newStandaloneDraft(
  overrides: DraftOverrides = {},
  now = new Date(),
): NfseDraft {
  const timestamp = now.toISOString();
  return {
    schema_version: SCHEMA_VERSION,
    source_invoice: null,
    dps: {
      environment: null,
      issued_at: null,
      application_version: "notaflow/0.1.0",
      series: null,
      number: null,
      competency_date: null,
      issuer_type: "1",
      city_code: null,
    },
    provider: {
      cnpj: null,
      cpf: null,
      municipal_registration: null,
      name: null,
      tax_regime: {
        simples_nacional_status: null,
        simples_nacional_assessment: null,
        special_tax_regime: null,
      },
    },
    recipient: {
      name: overrides.recipientName ?? null,
      address_lines: [],
      address: {
        street: null,
        number: null,
        complement: null,
        neighborhood: null,
        city: null,
        state_province_region: null,
        city_code: null,
        postal_code: null,
      },
      country_code: overrides.countryCode ?? null,
      country_name_pt: overrides.countryNamePt ?? null,
      foreign_tax_id: overrides.foreignTaxId ?? null,
      non_nif_reason: null,
    },
    amounts: {
      original_currency: overrides.originalCurrency ?? null,
      original_amount: overrides.originalAmount ?? null,
      exchange_rate_to_brl: null,
      brl_amount: null,
    },
    payment: {
      date: null,
      exchange_contract_number: null,
    },
    service: {
      description_pt: overrides.serviceDescriptionPt ?? null,
      description_source: overrides.serviceDescriptionPt ? "manual" : null,
      municipal_service_code: null,
      national_service_code: null,
      nbs_code: null,
      location_city_code: null,
      location_country_code: null,
      iss_withheld: null,
      notes: null,
    },
    foreign_trade: {
      service_mode: null,
      relationship: null,
      currency_code: null,
      provider_support: null,
      customer_support: null,
      temporary_goods_movement: null,
      import_declaration_number: null,
      export_registration_number: null,
      mdic_registration: null,
    },
    tax: {
      municipal_taxation: null,
      iss_withholding: null,
      result_country_code: null,
      pis_cofins_cst: null,
      total_tax: {
        disclosure_indicator: "0",
        simples_nacional_rate: null,
      },
    },
    evidence: [
      {
        type: "supporting_document",
        source: null,
        reference: null,
        date: null,
        local_file: null,
        extracted_with: null,
        notes: null,
      },
    ],
    outputs: {
      portal_html: null,
      checklist_md: null,
      dps_xml: null,
    },
    audit: {
      created_at: timestamp,
      updated_at: timestamp,
      notes: [
        "Review all fiscal fields before issuing the NFS-e.",
        "The NFS-e BRL amount must come from payment/conversion evidence, not from the invoice issue date.",
      ],
    },
  };
}

export function draftFromInvoice(
  invoice: ImportedInvoice,
  overrides: DraftOverrides = {},
  now = new Date(),
): NfseDraft {
  const draft = newStandaloneDraft(overrides, now);
  draft.source_invoice = {
    format: invoice.format,
    file: invoice.file,
    invoice_number: invoice.invoiceNumber,
    kind: invoice.kind,
    issue_date: invoice.issueDate,
    period: {
      start: invoice.periodStart,
      end: invoice.periodEnd,
    },
    description_en: invoice.descriptions,
  };
  draft.recipient.name = overrides.recipientName ?? invoice.recipientName;
  draft.recipient.address_lines = invoice.recipientAddress;
  draft.dps.competency_date = invoice.periodEnd;
  draft.amounts.original_currency =
    overrides.originalCurrency ?? invoice.currency;
  draft.amounts.original_amount = overrides.originalAmount ?? invoice.total;
  draft.audit.notes.unshift(
    "Source invoice data was copied into this draft; the source invoice was not modified.",
  );
  return draft;
}
