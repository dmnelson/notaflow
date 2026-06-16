import type { NfseDraft, ReadinessIssue } from "./types.js";

type PortalFieldKind = "input" | "radio" | "select" | "textarea" | "currency";

interface PortalField {
  label: string;
  value: string;
  kind: PortalFieldKind;
  wide: boolean;
  hint?: string;
}

interface PortalSection {
  title: string;
  fields: PortalField[];
  note?: string;
}

interface PortalStep {
  title: string;
  sections: PortalSection[];
}

interface PortalFieldOptions {
  kind?: PortalFieldKind;
  wide?: boolean;
  hint?: string;
}

export function renderPortalHtml(
  draft: NfseDraft,
  issues: ReadinessIssue[],
): string {
  const steps = portalSteps(draft);
  const errors = issues.filter((issue) => issue.severity === "error");
  const warning = errors.length
    ? `<section class="warning"><strong>Rascunho incompleto.</strong> ${errors.length} campo${errors.length === 1 ? "" : "s"} obrigatório${errors.length === 1 ? "" : "s"} pendente${errors.length === 1 ? "" : "s"}. Revise antes de emitir qualquer NFS-e.</section>`
    : `<section class="ready"><strong>Readiness checks passed.</strong> Review every value against the portal and supporting evidence before issuance.</section>`;
  const issueList =
    issues.length === 0
      ? "<p>No readiness issues reported.</p>"
      : `<ul>${issues
          .map(
            (issue) =>
              `<li><strong>${escapeHtml(issue.severity.toUpperCase())}</strong> <code>${escapeHtml(issue.path)}</code>: ${escapeHtml(issue.message)}</li>`,
          )
          .join("")}</ul>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NFS-e portal helper</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      color: #38424d;
      background: #f7f7f7;
      --nfse-green: #73a67b;
      --nfse-blue: #2e3f86;
      --section-bg: #f3f3f3;
      --field-border: #d7dce0;
      --field-bg: #fff;
      --disabled-bg: #e8e8e8;
    }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px 20px 64px; }
    h1 { margin: 0 0 6px; color: #4d6f52; font-size: 1.45rem; }
    .lede { color: #65727e; margin-top: 0; }
    .warning, .ready { border-radius: 4px; padding: 12px 14px; margin: 18px 0; }
    .warning { background: #fff3cd; border-left: 4px solid #d39e00; }
    .ready { background: #e5f3e7; border-left: 4px solid var(--nfse-green); }
    .stepper { display: grid; grid-template-columns: repeat(4, 1fr); align-items: center; gap: 8px; margin: 24px auto 18px; max-width: 800px; color: #9aa3ad; }
    .step { text-align: center; position: relative; font-size: 0.92rem; }
    .step::before { content: ""; position: absolute; top: 16px; left: -50%; width: 100%; border-top: 1px solid #d5d9dd; z-index: -1; }
    .step:first-child::before { display: none; }
    .dot { width: 32px; height: 32px; border-radius: 999px; display: grid; place-items: center; margin: 0 auto 6px; background: #d9d9d9; color: white; font-weight: 700; }
    .step.active .dot { background: var(--nfse-blue); }
    .step.done .dot { background: var(--nfse-green); }
    .portal-step { margin: 20px 0 28px; }
    .portal-step h2 { color: var(--nfse-blue); font-size: 1.05rem; margin: 0 0 12px; }
    .section { background: var(--section-bg); border: 1px solid #e4e6e8; margin: 12px 0; padding: 14px; }
    .section h3 { color: var(--nfse-green); font-size: 1rem; text-transform: uppercase; margin: 0 0 14px; }
    .section-note { border-left: 4px solid #75b7e8; background: #e6f3ff; padding: 10px 12px; margin: 12px 0; white-space: pre-wrap; }
    .fields { display: grid; grid-template-columns: repeat(12, 1fr); gap: 12px 16px; }
    .portal-field { grid-column: span 6; min-width: 0; }
    .portal-field.wide { grid-column: 1 / -1; }
    label { display: block; font-weight: 700; color: #58636f; margin-bottom: 5px; font-size: 0.86rem; }
    .value-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: stretch; }
    .value {
      min-height: 20px;
      background: var(--field-bg);
      border: 1px solid var(--field-border);
      padding: 9px 10px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.35;
    }
    .radio .value, .select .value { background: #fff; }
    .currency .value::before { content: "R$ "; color: #7b858f; }
    .textarea .value { min-height: 112px; }
    .missing { color: #a61b1b; background: #fff9f9; font-style: italic; }
    .hint { color: #73808c; margin-top: 4px; font-size: 0.8rem; }
    button { border: 1px solid #8c94ad; border-radius: 4px; background: #fff; padding: 0 10px; cursor: pointer; color: #2f3d78; font-weight: 700; }
    button:hover { background: #eef2f5; }
    button:disabled { color: #9ca3af; border-color: #d0d5da; cursor: not-allowed; background: #f4f4f4; }
    code { background: #eef2f5; padding: 2px 5px; border-radius: 4px; }
    footer { color: #65727e; font-size: 0.9rem; margin-top: 28px; }
    @media (max-width: 760px) {
      main { padding-inline: 12px; }
      .stepper { grid-template-columns: repeat(2, 1fr); }
      .portal-field { grid-column: 1 / -1; }
      .value-row { grid-template-columns: 1fr; }
      button { min-height: 34px; }
    }
  </style>
</head>
<body>
<main>
  <h1>NFS-e portal helper</h1>
  <p class="lede">Copy/paste aid only. Os campos seguem as telas oficiais do Emissor Nacional: Pessoas, Serviço e Valores/Tributação.</p>
  ${warning}
  <nav class="stepper" aria-label="Fluxo do portal">
    <div class="step done"><span class="dot">1</span>Pessoas</div>
    <div class="step done"><span class="dot">2</span>Serviço</div>
    <div class="step active"><span class="dot">3</span>Valores</div>
    <div class="step"><span class="dot">4</span>Emitir NFS-e</div>
  </nav>
  ${steps.map(renderStep).join("\n")}
  <section class="section">
    <h3>Readiness checks</h3>
    ${issueList}
  </section>
  <footer>Generated by notaflow from <code>${escapeHtml(draft.schema_version)}</code>.</footer>
</main>
<script>
  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-copy]");
    if (!button) return;
    await copyText(button.dataset.copy);
    const previous = button.textContent;
    button.textContent = "Copiado";
    setTimeout(() => { button.textContent = previous; }, 1200);
  });
</script>
</body>
</html>
`;
}

function portalSteps(draft: NfseDraft): PortalStep[] {
  return [
    {
      title: "Pessoas",
      sections: [
        {
          title: "Dados da DPS",
          fields: [
            field("Data de Competência *", formatDatePt(draft.dps.competency_date)),
            field(
              "Informar série e número da DPS",
              draft.dps.series || draft.dps.number ? "Sim" : "Não",
              { kind: "radio" },
            ),
            field("Série da DPS", draft.dps.series),
            field("Número da DPS", draft.dps.number),
          ],
        },
        {
          title: "Emitente da NFS-e",
          fields: [
            field(
              "Você irá emitir esta NFS-e como? *",
              issuerRoleLabel(draft.dps.issuer_type),
              { kind: "radio" },
            ),
            field("Município *", cityLabel(draft.dps.city_code)),
            field("Indicador Municipal *", draft.provider.municipal_registration),
            field("CNPJ", formatCnpj(draft.provider.cnpj)),
            field("CPF", formatCpf(draft.provider.cpf)),
            field("Razão Social", draft.provider.name),
            field(
              "Opção no Simples Nacional *",
              simplesStatusLabel(draft.provider.tax_regime.simples_nacional_status),
              { kind: "select" },
            ),
            field(
              "Regime de Apuração dos Tributos no Simples Nacional *",
              simplesAssessmentLabel(
                draft.provider.tax_regime.simples_nacional_assessment,
              ),
              { kind: "select", wide: true },
            ),
          ],
        },
        {
          title: "Tomador do Serviço",
          fields: [
            field(
              "Onde está localizado o estabelecimento/domicílio? *",
              recipientLocationLabel(draft),
              { kind: "radio" },
            ),
            field("O NIF será informado? *", nifInformedLabel(draft), {
              kind: "radio",
            }),
            field("NIF", draft.recipient.foreign_tax_id),
            field("Nome/Razão Social *", draft.recipient.name, { wide: true }),
            field("Telefone", null),
            field("E-mail", null),
            field("Logradouro *", draft.recipient.address.street),
            field("Número *", draft.recipient.address.number),
            field("Complemento", draft.recipient.address.complement),
            field("Bairro *", draft.recipient.address.neighborhood),
            field("Cidade *", draft.recipient.address.city),
            field("Código de Endereçamento Postal *", draft.recipient.address.postal_code),
            field(
              "Estado, província ou região *",
              draft.recipient.address.state_province_region,
            ),
            field("País *", recipientCountryName(draft), { kind: "select" }),
          ],
        },
        {
          title: "Intermediário do Serviço",
          fields: [
            field(
              "Onde está localizado o estabelecimento/domicílio? *",
              "Intermediário não informado",
              { kind: "radio" },
            ),
          ],
        },
      ],
    },
    {
      title: "Serviço",
      sections: [
        {
          title: "Local da Prestação do Serviço",
          fields: [
            field("País *", serviceCountryLabel(draft), { kind: "select" }),
            field("Município", cityLabel(draft.service.location_city_code), {
              kind: "select",
            }),
          ],
        },
        {
          title: "Serviço Prestado",
          ...(exportServiceNote(draft)
            ? { note: exportServiceNote(draft) as string }
            : {}),
          fields: [
            field(
              "Código de Tributação Nacional *",
              nationalServiceLabel(draft.service.national_service_code),
              { kind: "select", wide: true },
            ),
            field(
              "Código Complementar Municipal *",
              municipalServiceLabel(draft),
              { kind: "select", wide: true },
            ),
            field(
              "O serviço prestado é um caso de: imunidade, exportação de serviço ou não incidência do ISSQN? *",
              nonTaxationCaseLabel(draft),
              { kind: "radio", wide: true },
            ),
            field(
              "Qual o motivo da não tributação do ISSQN sobre o serviço prestado? *",
              municipalTaxationLabel(draft.tax.municipal_taxation),
              { kind: "select", wide: true },
            ),
            field("Descrição do Serviço *", draft.service.description_pt, {
              kind: "textarea",
              wide: true,
            }),
            field(
              "Item da NBS correspondente ao serviço prestado",
              nbsLabel(draft.service.nbs_code),
              { kind: "select", wide: true },
            ),
          ],
        },
        {
          title: "Informações para Comércio Exterior",
          fields: [
            field("Modo de Prestação *", serviceModeLabel(draft.foreign_trade.service_mode), {
              kind: "select",
            }),
            field(
              "Vínculo entre as partes no negócio *",
              relationshipLabel(draft.foreign_trade.relationship),
              { kind: "select" },
            ),
            field("Moeda *", currencyCodeLabel(draft.foreign_trade.currency_code)),
            field(
              "Valor do serviço em moeda estrangeira *",
              formatPtNumber(draft.amounts.original_amount),
            ),
            field(
              "Mecanismo de apoio/fomento ao Comércio Exterior utilizado pelo prestador do serviço *",
              providerSupportMechanismLabel(draft.foreign_trade.provider_support),
              { kind: "select" },
            ),
            field(
              "Mecanismo de apoio/fomento ao Comércio Exterior utilizado pelo tomador do serviço *",
              customerSupportMechanismLabel(draft.foreign_trade.customer_support),
              { kind: "select" },
            ),
            field(
              "Existe vínculo da operação à movimentação temporária de bens? *",
              temporaryGoodsLabel(draft.foreign_trade.temporary_goods_movement),
              { kind: "select", wide: true },
            ),
            field(
              "Deseja compartilhar a NFS-e que será gerada a partir desta DPS com o MDIC? *",
              mdicLabel(draft.foreign_trade.mdic_registration),
              { kind: "radio", wide: true },
            ),
          ],
        },
        {
          title: "Informações Complementares",
          fields: [
            field("Número do documento de responsabilidade técnica", null, {
              wide: true,
            }),
            field("Documento de referência", draft.payment.exchange_contract_number, {
              wide: true,
            }),
            field("Informações complementares", draft.service.notes, {
              kind: "textarea",
              wide: true,
            }),
            field(
              "Número do Pedido, Ordem de Compra, Ordem de Serviço ou Projeto que autorize a prestação do serviço em operações B2B",
              draft.source_invoice?.invoice_number ?? null,
              { wide: true },
            ),
          ],
        },
      ],
    },
    {
      title: "Valores / Tributação",
      sections: [
        {
          title: "Valores do Serviço Prestado",
          fields: [
            field("Valor do serviço prestado *", formatPtNumber(draft.amounts.brl_amount), {
              kind: "currency",
            }),
            field("Valor recebido pelo intermediário", null, { kind: "currency" }),
            field("Desconto incondicionado", null, { kind: "currency" }),
            field("Desconto condicionado", null, { kind: "currency" }),
          ],
        },
        {
          title: "Tributação Municipal",
          note:
            "As informações de Tributação Municipal abaixo devem ser conferidas no portal. Para exportação, o portal normalmente bloqueia parte dos campos conforme regras do sistema.",
          fields: [
            field(
              "Tributação do ISSQN sobre o serviço prestado",
              municipalTaxationLabel(draft.tax.municipal_taxation),
              { kind: "select" },
            ),
            field(
              "Regime Especial de Tributação",
              specialTaxRegimeLabel(draft.provider.tax_regime.special_tax_regime),
              { kind: "select" },
            ),
            field(
              "A exigibilidade do recolhimento do ISSQN devido nesta operação está suspensa? *",
              "Não",
              { kind: "radio", wide: true },
            ),
            field(
              "Há retenção do ISSQN pelo Tomador ou pelo Intermediário? *",
              issWithholdingYesNoLabel(draft.tax.iss_withholding),
              { kind: "radio", wide: true },
            ),
            field(
              "Este serviço prestado está amparado por algum benefício municipal? *",
              "Não",
              { kind: "radio", wide: true },
            ),
            field(
              "Será aplicado algum tipo de Dedução/Redução à base de cálculo do ISSQN? *",
              "Não",
              { kind: "radio", wide: true },
            ),
            field("Alíquota", null),
            field("BC ISSQN", null, { kind: "currency" }),
            field("Valor ISSQN", null, { kind: "currency" }),
          ],
        },
        {
          title: "Tributação Federal",
          fields: [
            field(
              "Situação Tributária do PIS/COFINS *",
              pisCofinsLabel(draft.tax.pis_cofins_cst),
              { kind: "select", wide: true },
            ),
            field("Tipo de retenção do PIS/COFINS/CSLL *", null, {
              kind: "select",
              wide: true,
            }),
            field("IRRF", null, { kind: "currency" }),
            field("Contribuições Sociais - Retidas", null, { kind: "currency" }),
            field("Contribuição Previdenciária - Retida", null, {
              kind: "currency",
            }),
          ],
        },
        {
          title: "Valor Aproximado dos Tributos",
          fields: [
            field(
              "Forma de preenchimento",
              draft.tax.total_tax.simples_nacional_rate !== null
                ? "Informar alíquota do Simples Nacional"
                : "Não informar valor aproximado dos tributos",
              { kind: "radio", wide: true },
            ),
            field(
              "Alíquota no Simples Nacional *",
              formatPtNumber(draft.tax.total_tax.simples_nacional_rate),
            ),
          ],
        },
      ],
    },
  ];
}

export function renderChecklistMarkdown(
  draft: NfseDraft,
  issues: ReadinessIssue[],
): string {
  const source = draft.source_invoice
    ? `${draft.source_invoice.invoice_number} (${draft.source_invoice.file})`
    : "Standalone draft";
  const readiness = issues
    .map(
      (issue) =>
        `- [ ] **${issue.severity.toUpperCase()}** \`${issue.path}\`: ${issue.message}`,
    )
    .join("\n");
  const evidence = draft.evidence
    .map(
      (entry) =>
        `- [ ] Verify ${entry.type}: ${entry.local_file ?? "local file not recorded"}`,
    )
    .join("\n");

  return `# NFS-e issuance checklist

Source: ${source}

## Draft readiness

${readiness || "- [x] Automated readiness checks passed"}

## Evidence review

${evidence || "- [ ] Add and review supporting evidence"}

## Portal entry

- [ ] Confirm the Pessoas screen: DPS competence, issuer, recipient, NIF, and foreign address.
- [ ] Confirm the Serviço screen: location, service codes, export reason, NBS, foreign-trade values, and complementary fields.
- [ ] Confirm the Valores/Tributação screen: BRL service value, ISSQN export taxation, federal taxation, and Simples Nacional approximate tax rate.
- [ ] Compare every portal field with the draft before proceeding.

## Final manual review

- [ ] Preview the NFS-e in the portal.
- [ ] Have the responsible person approve issuance.
- [ ] Manually issue through nfse.gov.br.
- [ ] Save the issued NFS-e and supporting evidence together.

> notaflow does not log in to nfse.gov.br and does not click "emitir".
`;
}

export function renderSummary(draft: NfseDraft, issues: ReadinessIssue[]): string {
  const source = draft.source_invoice?.invoice_number ?? "standalone";
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;
  return [
    `Schema: ${draft.schema_version}`,
    `Source: ${source}`,
    `Recipient: ${draft.recipient.name ?? "TODO"}`,
    `DPS: ${draft.dps.series ?? "TODO"}/${draft.dps.number ?? "TODO"}`,
    `Original amount: ${draft.amounts.original_currency ?? "TODO"} ${formatNumber(draft.amounts.original_amount) || "TODO"}`,
    `NFS-e amount: BRL ${formatNumber(draft.amounts.brl_amount) || "TODO"}`,
    `Payment date: ${draft.payment.date ?? "TODO"}`,
    `Service: ${draft.service.description_pt ?? "TODO"}`,
    `Readiness: ${errorCount} error(s), ${warningCount} warning(s)`,
  ].join("\n");
}

function renderStep(step: PortalStep): string {
  return `<article class="portal-step">
    <h2>${escapeHtml(step.title)}</h2>
    ${step.sections.map(renderSection).join("\n")}
  </article>`;
}

function renderSection(section: PortalSection): string {
  return `<section class="section">
    <h3>${escapeHtml(section.title)}</h3>
    ${section.note ? `<div class="section-note">${escapeHtml(section.note)}</div>` : ""}
    <div class="fields">
      ${section.fields.map(renderField).join("\n")}
    </div>
  </section>`;
}

function renderField(item: PortalField): string {
  const missing = item.value === "";
  return `<div class="portal-field ${item.kind}${item.wide ? " wide" : ""}">
    <label>${escapeHtml(item.label)}</label>
    <div class="value-row">
      <div class="value${missing ? " missing" : ""}">${missing ? "TODO" : escapeHtml(item.value)}</div>
      <button type="button" data-copy="${escapeAttribute(item.value)}"${missing ? " disabled" : ""}>Copiar</button>
    </div>
    ${item.hint ? `<div class="hint">${escapeHtml(item.hint)}</div>` : ""}
  </div>`;
}

function field(
  label: string,
  value: string | null | undefined,
  options: PortalFieldOptions = {},
): PortalField {
  return {
    label,
    value: value ?? "",
    kind: options.kind ?? "input",
    wide: options.wide ?? false,
    ...(options.hint ? { hint: options.hint } : {}),
  };
}

function exportServiceNote(draft: NfseDraft): string | undefined {
  if (draft.tax.municipal_taxation !== "3") return undefined;
  return [
    "Para efeitos do ISSQN, uma operação pode representar uma exportação de serviço quando:",
    "a) o serviço foi concluído no exterior; ou",
    "b) o resultado desta prestação é verificado no exterior.",
  ].join("\n");
}

function issuerRoleLabel(value: "1" | "2" | "3" | null): string | null {
  if (value === "1") return "Prestador";
  if (value === "2") return "Tomador";
  if (value === "3") return "Intermediário";
  return null;
}

function recipientLocationLabel(draft: NfseDraft): string | null {
  if (!draft.recipient.name) return "Tomador não informado";
  if (draft.recipient.country_code === "BR") return "Brasil";
  if (draft.recipient.country_code) return "Exterior";
  return null;
}

function nifInformedLabel(draft: NfseDraft): string | null {
  if (draft.recipient.foreign_tax_id) return "Sim";
  if (draft.recipient.non_nif_reason) return "Não";
  return null;
}

function recipientCountryName(draft: NfseDraft): string | null {
  return countryNameByCode(draft.recipient.country_code, draft.recipient.country_name_pt);
}

function serviceCountryLabel(draft: NfseDraft): string | null {
  if (draft.service.location_country_code) {
    return countryNameByCode(
      draft.service.location_country_code,
      draft.recipient.country_name_pt,
    );
  }
  if (draft.service.location_city_code || draft.dps.city_code) return "Brasil";
  return countryNameByCode(
    draft.tax.result_country_code ?? draft.recipient.country_code,
    draft.recipient.country_name_pt,
  );
}

function countryNameByCode(
  code: string | null,
  preferredName: string | null,
): string | null {
  if (!code) return null;
  if (preferredName) return preferredName;
  if (code === "BR") return "Brasil";
  if (code === "GB") return "Reino Unido";
  if (code === "US") return "Estados Unidos";
  return code;
}

function cityLabel(code: string | null): string | null {
  if (!code) return null;
  if (code === "3106200") return "Belo Horizonte/MG";
  if (code === "3550308") return "São Paulo/SP";
  return code;
}

function nationalServiceLabel(code: string | null): string | null {
  if (!code) return null;
  if (code === "010101") return "01.01.01 - Análise e desenvolvimento de sistemas.";
  return code;
}

function municipalServiceLabel(draft: NfseDraft): string | null {
  if (!draft.service.municipal_service_code) return null;
  if (
    draft.service.national_service_code === "010101" &&
    draft.service.municipal_service_code === "001"
  ) {
    return "01.01.01.001 - Análise e desenvolvimento de sistemas";
  }
  return draft.service.municipal_service_code;
}

function nbsLabel(code: string | null): string | null {
  if (!code) return null;
  if (code === "115080000") return "115080000 - Serviços de manutenção de aplicativos e programas";
  return code;
}

function nonTaxationCaseLabel(draft: NfseDraft): string | null {
  if (!draft.tax.municipal_taxation) return null;
  return ["2", "3", "4"].includes(draft.tax.municipal_taxation) ? "Sim" : "Não";
}

function municipalTaxationLabel(value: "1" | "2" | "3" | "4" | null): string | null {
  if (value === "1") return "Operação tributável";
  if (value === "2") return "Imunidade";
  if (value === "3") return "Exportação de Serviço";
  if (value === "4") return "Não incidência";
  return null;
}

function simplesStatusLabel(value: "1" | "2" | "3" | null): string | null {
  if (value === "1") return "Não optante pelo Simples Nacional";
  if (value === "2") return "Optante - Microempreendedor Individual (MEI)";
  if (value === "3") return "Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)";
  return null;
}

function simplesAssessmentLabel(value: "1" | "2" | "3" | null): string | null {
  if (value === "1") {
    return "Regime de apuração dos tributos federais e municipal pelo Simples Nacional";
  }
  if (value === "2") return "Regime de apuração municipal fora do Simples Nacional";
  if (value === "3") return "Não se aplica";
  return null;
}

function specialTaxRegimeLabel(
  value: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "9" | null,
): string | null {
  if (value === "0") return "Nenhum";
  return value;
}

function serviceModeLabel(value: "0" | "1" | "2" | "3" | "4" | null): string | null {
  if (value === "0") return "Modo não informado";
  if (value === "1") return "Comércio transfronteiriço";
  if (value === "2") return "Consumo no Brasil";
  if (value === "3") return "Presença comercial no exterior";
  if (value === "4") return "Consumo no Exterior";
  return null;
}

function relationshipLabel(
  value: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "9" | null,
): string | null {
  if (value === "0") return "Sem vínculo entre as partes";
  return value;
}

function currencyCodeLabel(value: string | null): string | null {
  if (!value) return null;
  if (value === "220") return "220 - Dólar dos Estados Unidos";
  if (value === "540") return "540 - Libra Esterlina";
  if (value === "978") return "978 - Euro";
  return value;
}

function providerSupportMechanismLabel(value: string | null): string | null {
  if (!value) return null;
  if (value === "01") {
    return "01 - ACC - Adiantamento sobre Contrato de Câmbio";
  }
  return value;
}

function customerSupportMechanismLabel(value: string | null): string | null {
  if (!value) return null;
  if (value === "01") return "01 - Administração Pública e Representação Internacional";
  return value;
}

function temporaryGoodsLabel(value: "0" | "1" | "2" | "3" | null): string | null {
  if (value === "0") return "Não informado";
  if (value === "1") return "Não";
  if (value === "2") return "Sim, com DI";
  if (value === "3") return "Sim, com RE";
  return null;
}

function mdicLabel(value: "0" | "1" | null): string | null {
  if (value === "0") return "Não";
  if (value === "1") return "Sim";
  return null;
}

function issWithholdingYesNoLabel(value: "1" | "2" | "3" | null): string | null {
  if (value === "1") return "Não";
  if (value === "2" || value === "3") return "Sim";
  return null;
}

function pisCofinsLabel(value: string | null): string | null {
  if (!value) return null;
  if (value === "00") return "00";
  return value;
}

function formatDatePt(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function formatCnpj(value: string | null): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length !== 14) return value;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCpf(value: string | null): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPtNumber(value: number | null): string | null {
  if (value === null) return null;
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number | null): string {
  return value === null ? "" : value.toFixed(2);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}
