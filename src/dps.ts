import {
  createDps,
  decimal,
  decimal2v2,
  serializeDps,
  validateDps,
  type DpsInput,
} from "nfse-js/core";
import { DpsValidationError } from "nfse-js";
import { validateDpsXml } from "nfse-js/validation";

import type { NfseDraft, ReadinessIssue } from "./types.js";

type NfseProvider = DpsInput["infDPS"]["prest"];
type NfsePerson = NonNullable<DpsInput["infDPS"]["toma"]>;
type NfseAddress = NonNullable<NfsePerson["end"]>;
type NfseForeignTrade = NonNullable<DpsInput["infDPS"]["serv"]["comExt"]>;
type NfseTotalTax = DpsInput["infDPS"]["valores"]["trib"]["totTrib"];

export interface DpsInputBuild {
  input: DpsInput | null;
  issues: ReadinessIssue[];
}

export interface DpsXmlResult {
  xml: string | null;
  issues: ReadinessIssue[];
}

export function dpsReadinessIssues(draft: NfseDraft): ReadinessIssue[] {
  return buildDpsInput(draft).issues;
}

export function buildDpsInput(draft: NfseDraft): DpsInputBuild {
  const issues: ReadinessIssue[] = [];

  const tpAmb = requiredString(issues, "dps.environment", draft.dps.environment);
  const dhEmi = normalizeDpsDateTime(
    requiredString(issues, "dps.issued_at", draft.dps.issued_at),
  );
  const verAplic = requiredString(
    issues,
    "dps.application_version",
    draft.dps.application_version,
  );
  const serie = requiredString(issues, "dps.series", draft.dps.series);
  const nDPS = requiredString(issues, "dps.number", draft.dps.number);
  const dCompet = requiredString(
    issues,
    "dps.competency_date",
    draft.dps.competency_date,
  );
  const tpEmit = requiredString(issues, "dps.issuer_type", draft.dps.issuer_type);
  const cLocEmi = requiredString(issues, "dps.city_code", draft.dps.city_code);
  const prest = providerFromDraft(draft, issues);
  const toma = recipientFromDraft(draft, issues);
  const serv = serviceFromDraft(draft, issues);
  const valores = valuesFromDraft(draft, issues);

  if (
    issues.some((issue) => issue.severity === "error") ||
    !tpAmb ||
    !dhEmi ||
    !verAplic ||
    !serie ||
    !nDPS ||
    !dCompet ||
    !tpEmit ||
    !cLocEmi ||
    !prest ||
    !toma ||
    !serv ||
    !valores
  ) {
    return { input: null, issues };
  }

  return {
    input: {
      infDPS: {
        tpAmb: tpAmb as DpsInput["infDPS"]["tpAmb"],
        dhEmi,
        verAplic,
        serie,
        nDPS,
        dCompet,
        tpEmit: tpEmit as DpsInput["infDPS"]["tpEmit"],
        cLocEmi,
        prest,
        toma,
        serv,
        valores,
      },
    },
    issues,
  };
}

export async function generateDpsXml(draft: NfseDraft): Promise<DpsXmlResult> {
  const build = buildDpsInput(draft);
  if (!build.input) {
    return { xml: null, issues: build.issues };
  }

  const dps = createDps(build.input);
  const semantic = validateDps(dps);
  if (!semantic.valid) {
    return {
      xml: null,
      issues: semantic.issues.map((issue) => ({
        severity: "error",
        path: `dps.${issue.path}`,
        message: issue.officialCode
          ? `${issue.officialCode}: ${issue.message}`
          : issue.message,
      })),
    };
  }

  let xml: string;
  try {
    xml = serializeDps(dps, { pretty: true });
  } catch (error) {
    if (error instanceof DpsValidationError) {
      return {
        xml: null,
        issues: error.issues.map((issue) => ({
          severity: "error",
          path: `dps.${issue.path}`,
          message: issue.officialCode
            ? `${issue.officialCode}: ${issue.message}`
            : issue.message,
        })),
      };
    }
    throw error;
  }

  const xsd = await validateDpsXml(xml, { throwOnInvalid: false });
  if (!xsd.valid) {
    return {
      xml: null,
      issues: xsd.violations.map((violation) => ({
        severity: "error",
        path: "dps.xml",
        message:
          violation.line === undefined
            ? violation.message
            : `line ${violation.line}: ${violation.message}`,
      })),
    };
  }

  return { xml, issues: [] };
}

function providerFromDraft(
  draft: NfseDraft,
  issues: ReadinessIssue[],
): NfseProvider | null {
  const taxId = providerTaxId(draft, issues);
  const opSimpNac = requiredString(
    issues,
    "provider.tax_regime.simples_nacional_status",
    draft.provider.tax_regime.simples_nacional_status,
  );
  const regEspTrib = requiredString(
    issues,
    "provider.tax_regime.special_tax_regime",
    draft.provider.tax_regime.special_tax_regime,
  );

  if (!taxId || !opSimpNac || !regEspTrib) {
    return null;
  }

  const municipalRegistration = trimOrNull(draft.provider.municipal_registration);
  const providerName =
    draft.dps.issuer_type === "1" ? null : trimOrNull(draft.provider.name);

  return {
    ...taxId,
    ...(municipalRegistration ? { IM: municipalRegistration } : {}),
    ...(providerName ? { xNome: providerName } : {}),
    regTrib: {
      opSimpNac,
      ...(present(draft.provider.tax_regime.simples_nacional_assessment)
        ? { regApTribSN: draft.provider.tax_regime.simples_nacional_assessment }
        : {}),
      regEspTrib,
    },
  } as NfseProvider;
}

function providerTaxId(
  draft: NfseDraft,
  issues: ReadinessIssue[],
): { readonly CNPJ: string } | { readonly CPF: string } | null {
  const cnpj = compactDigits(draft.provider.cnpj);
  const cpf = compactDigits(draft.provider.cpf);
  if (cnpj && cpf) {
    issues.push({
      severity: "error",
      path: "provider",
      message: "provide either provider.cnpj or provider.cpf, not both",
    });
    return null;
  }
  if (cnpj) return { CNPJ: cnpj };
  if (cpf) return { CPF: cpf };
  issues.push({
    severity: "error",
    path: "provider.cnpj",
    message: "missing provider CNPJ or CPF",
  });
  return null;
}

function recipientFromDraft(
  draft: NfseDraft,
  issues: ReadinessIssue[],
): NfsePerson | null {
  const xNome = requiredString(issues, "recipient.name", draft.recipient.name);
  const identity = recipientIdentity(draft, issues);
  if (!xNome || !identity) {
    return null;
  }

  const end = recipientAddressFromDraft(draft, issues);
  if (issues.some((issue) => issue.path.startsWith("recipient.address."))) {
    return null;
  }

  return {
    ...identity,
    xNome,
    ...(end ? { end } : {}),
  } as NfsePerson;
}

function recipientIdentity(
  draft: NfseDraft,
  issues: ReadinessIssue[],
): { readonly NIF: string } | { readonly cNaoNIF: "0" | "1" | "2" } | null {
  if (present(draft.recipient.foreign_tax_id)) {
    return { NIF: trimOrNull(draft.recipient.foreign_tax_id) as string };
  }
  if (draft.recipient.non_nif_reason) {
    return { cNaoNIF: draft.recipient.non_nif_reason };
  }
  issues.push({
    severity: "error",
    path: "recipient.foreign_tax_id",
    message: "missing recipient NIF or non_nif_reason",
  });
  return null;
}

function recipientAddressFromDraft(
  draft: NfseDraft,
  issues: ReadinessIssue[],
): NfseAddress | undefined {
  const address = draft.recipient.address;
  if (!Object.values(address).some(present)) {
    return undefined;
  }

  const xLgr = requiredString(issues, "recipient.address.street", address.street);
  const nro = requiredString(issues, "recipient.address.number", address.number);
  const xBairro = requiredString(
    issues,
    "recipient.address.neighborhood",
    address.neighborhood,
  );
  if (!xLgr || !nro || !xBairro) return undefined;

  const complement = trimOrNull(address.complement);

  if (draft.recipient.country_code === "BR") {
    const cMun = requiredString(
      issues,
      "recipient.address.city_code",
      address.city_code,
    );
    const CEP = compactDigits(
      requiredString(issues, "recipient.address.postal_code", address.postal_code),
    );
    if (!cMun || !CEP) return undefined;
    return {
      endNac: { cMun, CEP },
      xLgr,
      nro,
      ...(complement ? { xCpl: complement } : {}),
      xBairro,
    };
  }

  const cPais = requiredString(
    issues,
    "recipient.country_code",
    draft.recipient.country_code,
  );
  const cEndPost = requiredString(
    issues,
    "recipient.address.postal_code",
    address.postal_code,
  );
  const xCidade = requiredString(issues, "recipient.address.city", address.city);
  const xEstProvReg = requiredString(
    issues,
    "recipient.address.state_province_region",
    address.state_province_region,
  );
  if (!cPais || !cEndPost || !xCidade || !xEstProvReg) return undefined;
  return {
    endExt: {
      cPais,
      cEndPost,
      xCidade,
      xEstProvReg,
    },
    xLgr,
    nro,
    ...(complement ? { xCpl: complement } : {}),
    xBairro,
  };
}

function serviceFromDraft(
  draft: NfseDraft,
  issues: ReadinessIssue[],
): DpsInput["infDPS"]["serv"] | null {
  const cTribNac = requiredString(
    issues,
    "service.national_service_code",
    draft.service.national_service_code,
  );
  const xDescServ = requiredString(
    issues,
    "service.description_pt",
    draft.service.description_pt,
  );
  const cLocPrestacao =
    trimOrNull(draft.service.location_city_code) ?? trimOrNull(draft.dps.city_code);
  const cPaisPrestacao = trimOrNull(draft.service.location_country_code);
  const comExt = foreignTradeFromDraft(draft, issues);
  const municipalServiceCode = trimOrNull(draft.service.municipal_service_code);
  const nbsCode = trimOrNull(draft.service.nbs_code);

  if (!cTribNac || !xDescServ || (!cLocPrestacao && !cPaisPrestacao)) {
    if (!cLocPrestacao && !cPaisPrestacao) {
      issues.push({
        severity: "error",
        path: "service.location_city_code",
        message: "missing service location city or country code",
      });
    }
    return null;
  }
  if (issues.some((issue) => issue.path.startsWith("foreign_trade."))) {
    return null;
  }

  return {
    locPrest: cPaisPrestacao ? { cPaisPrestacao } : { cLocPrestacao: cLocPrestacao as string },
    cServ: {
      cTribNac,
      ...(municipalServiceCode ? { cTribMun: municipalServiceCode } : {}),
      xDescServ,
      ...(nbsCode ? { cNBS: nbsCode } : {}),
    },
    ...(comExt ? { comExt } : {}),
  };
}

function foreignTradeFromDraft(
  draft: NfseDraft,
  issues: ReadinessIssue[],
): NfseForeignTrade | null {
  if (!shouldUseForeignTrade(draft)) {
    return null;
  }

  const mdPrestacao = requiredString(
    issues,
    "foreign_trade.service_mode",
    draft.foreign_trade.service_mode,
  );
  const vincPrest = requiredString(
    issues,
    "foreign_trade.relationship",
    draft.foreign_trade.relationship,
  );
  const tpMoeda = requiredString(
    issues,
    "foreign_trade.currency_code",
    draft.foreign_trade.currency_code,
  );
  const originalAmount = requiredNumber(
    issues,
    "amounts.original_amount",
    draft.amounts.original_amount,
  );
  const mecAFComexP = requiredString(
    issues,
    "foreign_trade.provider_support",
    draft.foreign_trade.provider_support,
  );
  const mecAFComexT = requiredString(
    issues,
    "foreign_trade.customer_support",
    draft.foreign_trade.customer_support,
  );
  const movTempBens = requiredString(
    issues,
    "foreign_trade.temporary_goods_movement",
    draft.foreign_trade.temporary_goods_movement,
  );
  const mdic = requiredString(
    issues,
    "foreign_trade.mdic_registration",
    draft.foreign_trade.mdic_registration,
  );

  if (
    !mdPrestacao ||
    !vincPrest ||
    !tpMoeda ||
    originalAmount === null ||
    !mecAFComexP ||
    !mecAFComexT ||
    !movTempBens ||
    !mdic
  ) {
    return null;
  }

  const importDeclarationNumber = trimOrNull(
    draft.foreign_trade.import_declaration_number,
  );
  const exportRegistrationNumber = trimOrNull(
    draft.foreign_trade.export_registration_number,
  );

  return {
    mdPrestacao,
    vincPrest,
    tpMoeda,
    vServMoeda: decimal(formatMoney(originalAmount)),
    mecAFComexP,
    mecAFComexT,
    movTempBens,
    ...(importDeclarationNumber ? { nDI: importDeclarationNumber } : {}),
    ...(exportRegistrationNumber ? { nRE: exportRegistrationNumber } : {}),
    mdic,
  } as NfseForeignTrade;
}

function valuesFromDraft(
  draft: NfseDraft,
  issues: ReadinessIssue[],
): DpsInput["infDPS"]["valores"] | null {
  const vServ = requiredNumber(issues, "amounts.brl_amount", draft.amounts.brl_amount);
  const tribISSQN = requiredString(
    issues,
    "tax.municipal_taxation",
    draft.tax.municipal_taxation,
  );
  const tpRetISSQN =
    trimOrNull(draft.tax.iss_withholding) ?? withholdingFromBoolean(draft);
  if (!tpRetISSQN) {
    issues.push({
      severity: "error",
      path: "tax.iss_withholding",
      message: "missing ISS withholding code",
    });
  }

  if (vServ === null || !tribISSQN || !tpRetISSQN) {
    return null;
  }

  const pisCofinsCst = trimOrNull(draft.tax.pis_cofins_cst);
  const cPaisResult = resultCountryCode(draft);

  return {
    vServPrest: {
      vServ: decimal(formatMoney(vServ)),
    },
    trib: {
      tribMun: {
        tribISSQN: tribISSQN as NonNullable<
          DpsInput["infDPS"]["valores"]["trib"]["tribMun"]["tribISSQN"]
        >,
        ...(cPaisResult ? { cPaisResult } : {}),
        tpRetISSQN: tpRetISSQN as NonNullable<
          DpsInput["infDPS"]["valores"]["trib"]["tribMun"]["tpRetISSQN"]
        >,
      },
      ...(pisCofinsCst ? { tribFed: { piscofins: { CST: pisCofinsCst } } } : {}),
      totTrib: totalTaxFromDraft(draft),
    },
  };
}

function totalTaxFromDraft(draft: NfseDraft): NfseTotalTax {
  if (draft.tax.total_tax.simples_nacional_rate !== null) {
    return {
      pTotTribSN: decimal2v2(formatMoney(draft.tax.total_tax.simples_nacional_rate)),
    };
  }
  return { indTotTrib: "0" };
}

function resultCountryCode(draft: NfseDraft): string | null {
  return (
    trimOrNull(draft.tax.result_country_code) ??
    (draft.recipient.country_code && draft.recipient.country_code !== "BR"
      ? draft.recipient.country_code
      : null)
  );
}

function withholdingFromBoolean(draft: NfseDraft): "1" | "2" | null {
  if (draft.service.iss_withheld === false) return "1";
  if (draft.service.iss_withheld === true) return "2";
  return null;
}

function shouldUseForeignTrade(draft: NfseDraft): boolean {
  if (Object.values(draft.foreign_trade).some(present)) {
    return true;
  }
  return Boolean(
    draft.recipient.country_code &&
      draft.recipient.country_code !== "BR" &&
      draft.amounts.original_currency &&
      draft.amounts.original_currency !== "BRL",
  );
}

function requiredString(
  issues: ReadinessIssue[],
  path: string,
  value: string | null,
): string | null {
  const trimmed = trimOrNull(value);
  if (trimmed) return trimmed;
  issues.push({
    severity: "error",
    path,
    message: "missing value required for DPS XML generation",
  });
  return null;
}

function requiredNumber(
  issues: ReadinessIssue[],
  path: string,
  value: number | null,
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  issues.push({
    severity: "error",
    path,
    message: "missing numeric value required for DPS XML generation",
  });
  return null;
}

function trimOrNull(value: string | null): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeDpsDateTime(value: string | null): string | null {
  return (
    value
      ?.replace(/\.\d{3}(Z|[+-]\d{2}:\d{2})$/, "$1")
      .replace(/Z$/, "+00:00") ?? null
  );
}

function present(value: unknown): boolean {
  return typeof value === "string" ? value.trim() !== "" : value !== null && value !== undefined;
}

function compactDigits(value: string | null): string | null {
  const compacted = value?.replace(/\D/g, "") ?? "";
  return compacted === "" ? null : compacted;
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}
