export const SCHEMA_VERSION = "nfse_draft.v1" as const;

export interface Period {
  start: string;
  end: string;
}

export interface SourceInvoice {
  format: string;
  file: string;
  invoice_number: string;
  kind: string | null;
  issue_date: string;
  period: Period;
  description_en: string[];
}

export interface Recipient {
  name: string | null;
  address_lines: string[];
  address: RecipientAddress;
  country_code: string | null;
  country_name_pt: string | null;
  foreign_tax_id: string | null;
  non_nif_reason: "0" | "1" | "2" | null;
}

export interface RecipientAddress {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state_province_region: string | null;
  city_code: string | null;
  postal_code: string | null;
}

export interface Amounts {
  original_currency: string | null;
  original_amount: number | null;
  exchange_rate_to_brl: number | null;
  brl_amount: number | null;
}

export interface Payment {
  date: string | null;
  exchange_contract_number: string | null;
}

export interface DpsSettings {
  environment: "1" | "2" | null;
  issued_at: string | null;
  application_version: string | null;
  series: string | null;
  number: string | null;
  competency_date: string | null;
  issuer_type: "1" | "2" | "3" | null;
  city_code: string | null;
}

export interface Provider {
  cnpj: string | null;
  cpf: string | null;
  municipal_registration: string | null;
  name: string | null;
  tax_regime: ProviderTaxRegime;
}

export interface ProviderTaxRegime {
  simples_nacional_status: "1" | "2" | "3" | null;
  simples_nacional_assessment: "1" | "2" | "3" | null;
  special_tax_regime: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "9" | null;
}

export interface Service {
  description_pt: string | null;
  description_source: "manual" | "template" | "assisted" | null;
  municipal_service_code: string | null;
  national_service_code: string | null;
  nbs_code: string | null;
  location_city_code: string | null;
  location_country_code: string | null;
  iss_withheld: boolean | null;
  notes: string | null;
}

export interface ForeignTrade {
  service_mode: "0" | "1" | "2" | "3" | "4" | null;
  relationship: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "9" | null;
  currency_code: string | null;
  provider_support: string | null;
  customer_support: string | null;
  temporary_goods_movement: "0" | "1" | "2" | "3" | null;
  import_declaration_number: string | null;
  export_registration_number: string | null;
  mdic_registration: "0" | "1" | null;
}

export interface Tax {
  municipal_taxation: "1" | "2" | "3" | "4" | null;
  iss_withholding: "1" | "2" | "3" | null;
  result_country_code: string | null;
  pis_cofins_cst: string | null;
  total_tax: TotalTax;
}

export interface TotalTax {
  disclosure_indicator: "0" | null;
  simples_nacional_rate: number | null;
}

export interface Evidence {
  type: string;
  source: string | null;
  reference: string | null;
  date: string | null;
  local_file: string | null;
  extracted_with: string | null;
  notes: string | null;
}

export interface Outputs {
  portal_html: string | null;
  checklist_md: string | null;
  dps_xml: string | null;
}

export interface Audit {
  created_at: string;
  updated_at: string;
  notes: string[];
}

export interface NfseDraft {
  schema_version: typeof SCHEMA_VERSION;
  source_invoice: SourceInvoice | null;
  dps: DpsSettings;
  provider: Provider;
  recipient: Recipient;
  amounts: Amounts;
  payment: Payment;
  service: Service;
  foreign_trade: ForeignTrade;
  tax: Tax;
  evidence: Evidence[];
  outputs: Outputs;
  audit: Audit;
}

export interface ReadinessIssue {
  severity: "error" | "warning";
  path: string;
  message: string;
}

export type UnknownRecord = Record<string, unknown>;
