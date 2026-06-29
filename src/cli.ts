#!/usr/bin/env node

import { Command, InvalidArgumentError, Option } from "commander";

import {
  renderChecklistMarkdown,
  renderPortalHtml,
  renderSummary,
} from "./artifacts.js";
import {
  draftFromInvoice,
  newStandaloneDraft,
  type DraftOverrides,
} from "./draft.js";
import { generateDpsXml } from "./dps.js";
import { importInvoice, listInvoiceImporters } from "./invoice.js";
import { writeDraft, writeTextFile } from "./io.js";
import { validateDraftFile } from "./validation.js";
import { PACKAGE_VERSION } from "./version.js";

const program = new Command()
  .name("notaflow")
  .description("Prepare auditable NFS-e drafts for manual portal issuance.")
  .version(PACKAGE_VERSION);

program
  .command("from-invoice")
  .alias("init")
  .description("Create an NFS-e draft from a supported invoice source file.")
  .argument("<invoice-file>", "supported invoice YAML or JSON")
  .requiredOption("-o, --out <draft-file>", "NFS-e draft YAML to create")
  .option(
    "--invoice-format <format>",
    `invoice importer to use (default: auto; supported: ${listInvoiceImporters()
      .map((importer) => importer.id)
      .join(", ")})`,
  )
  .option(
    "--invoice-workspace <directory>",
    "workspace used by importers that resolve external client/profile files",
  )
  .addOption(new Option("--country-code <code>", "recipient ISO country code"))
  .option("--country-name-pt <name>", "recipient country name in Portuguese")
  .option("--foreign-tax-id <id>", "recipient foreign tax ID")
  .option(
    "--service-description-pt <text>",
    "reviewed Portuguese service description",
  )
  .action(
    async (
      invoiceFile: string,
      options: {
        out: string;
        invoiceFormat?: string;
        invoiceWorkspace?: string;
        countryCode?: string;
        countryNamePt?: string;
        foreignTaxId?: string;
        serviceDescriptionPt?: string;
      },
    ) => {
      await run(async () => {
        const invoice = await importInvoice(invoiceFile, {
          draftFile: options.out,
          ...(options.invoiceFormat ? { format: options.invoiceFormat } : {}),
          ...(options.invoiceWorkspace
            ? { invoiceWorkspace: options.invoiceWorkspace }
            : {}),
        });
        const draft = draftFromInvoice(invoice, overridesFrom(options));
        await writeDraft(options.out, draft);
        console.log(`Created ${options.out}`);
      });
    },
  );

program
  .command("new")
  .description("Create a standalone NFS-e draft without a commercial invoice.")
  .argument("<draft-file>", "NFS-e draft YAML to create")
  .option("--recipient-name <name>", "recipient name")
  .option("--country-code <code>", "recipient ISO country code")
  .option("--country-name-pt <name>", "recipient country name in Portuguese")
  .option("--foreign-tax-id <id>", "recipient foreign tax ID")
  .option("--currency <code>", "original 3-letter currency code")
  .option("--amount <amount>", "original amount", parseNonNegativeNumber)
  .option(
    "--service-description-pt <text>",
    "reviewed Portuguese service description",
  )
  .action(
    async (
      draftFile: string,
      options: {
        recipientName?: string;
        countryCode?: string;
        countryNamePt?: string;
        foreignTaxId?: string;
        currency?: string;
        amount?: number;
        serviceDescriptionPt?: string;
      },
    ) => {
      await run(async () => {
        const draft = newStandaloneDraft({
          ...overridesFrom(options),
          ...(options.currency
            ? { originalCurrency: options.currency.toUpperCase() }
            : {}),
          ...(options.amount !== undefined
            ? { originalAmount: options.amount }
            : {}),
        });
        await writeDraft(draftFile, draft);
        console.log(`Created ${draftFile}`);
      });
    },
  );

program
  .command("validate")
  .description("Validate draft structure and issuance readiness.")
  .argument("<draft-file>", "NFS-e draft YAML or JSON")
  .option(
    "--allow-incomplete",
    "exit successfully when only readiness fields are missing",
  )
  .action(
    async (draftFile: string, options: { allowIncomplete?: boolean }) => {
      await run(async () => {
        const result = await validateDraftFile(draftFile);
        if (result.schemaErrors.length > 0) {
          console.error("Schema errors:");
          result.schemaErrors.forEach((error) => console.error(`- ${error}`));
          process.exitCode = 1;
          return;
        }

        const errors = result.readiness.filter(
          (issue) => issue.severity === "error",
        );
        const warnings = result.readiness.filter(
          (issue) => issue.severity === "warning",
        );
        console.log("Schema valid: nfse_draft.v1");
        result.readiness.forEach((issue) =>
          console.log(
            `${issue.severity.toUpperCase()} ${issue.path}: ${issue.message}`,
          ),
        );
        console.log(
          `Readiness: ${errors.length} error(s), ${warnings.length} warning(s)`,
        );
        if (errors.length > 0 && !options.allowIncomplete) {
          process.exitCode = 1;
        }
      });
    },
  );

program
  .command("portal")
  .description("Generate a local copy/paste helper for nfse.gov.br.")
  .argument("<draft-file>", "NFS-e draft YAML or JSON")
  .requiredOption("-o, --out <html-file>", "HTML file to create")
  .action(async (draftFile: string, options: { out: string }) => {
    await run(async () => {
      const result = await validateDraftFile(draftFile);
      if (!result.draft) {
        throw new Error(
          `Invalid NFS-e draft structure:\n${result.schemaErrors.join("\n")}`,
        );
      }
      await writeTextFile(
        options.out,
        renderPortalHtml(result.draft, result.readiness),
      );
      console.log(`Created ${options.out}`);
    });
  });

program
  .command("checklist")
  .description("Generate a Markdown checklist for manual NFS-e issuance.")
  .argument("<draft-file>", "NFS-e draft YAML or JSON")
  .requiredOption("-o, --out <markdown-file>", "Markdown file to create")
  .action(async (draftFile: string, options: { out: string }) => {
    await run(async () => {
      const result = await validateDraftFile(draftFile);
      if (!result.draft) {
        throw new Error(
          `Invalid NFS-e draft structure:\n${result.schemaErrors.join("\n")}`,
        );
      }
      await writeTextFile(
        options.out,
        renderChecklistMarkdown(result.draft, result.readiness),
      );
      console.log(`Created ${options.out}`);
    });
  });

program
  .command("summary")
  .description("Print a concise NFS-e draft summary.")
  .argument("<draft-file>", "NFS-e draft YAML or JSON")
  .action(async (draftFile: string) => {
    await run(async () => {
      const result = await validateDraftFile(draftFile);
      if (!result.draft) {
        throw new Error(
          `Invalid NFS-e draft structure:\n${result.schemaErrors.join("\n")}`,
        );
      }
      console.log(renderSummary(result.draft, result.readiness));
    });
  });

program
  .command("dps")
  .description("Generate unsigned, schema-validated DPS XML from a draft.")
  .argument("<draft-file>", "NFS-e draft YAML or JSON")
  .requiredOption("-o, --out <xml-file>", "DPS XML file to create")
  .action(async (draftFile: string, options: { out: string }) => {
    await run(async () => {
      const result = await validateDraftFile(draftFile);
      if (!result.draft) {
        throw new Error(
          `Invalid NFS-e draft structure:\n${result.schemaErrors.join("\n")}`,
        );
      }

      const generated = await generateDpsXml(result.draft);
      if (!generated.xml) {
        console.error("DPS XML errors:");
        generated.issues.forEach((issue) =>
          console.error(`- ${issue.path}: ${issue.message}`),
        );
        process.exitCode = 1;
        return;
      }

      await writeTextFile(options.out, generated.xml);
      console.log(`Created ${options.out}`);
    });
  });

await program.parseAsync();

function overridesFrom(options: {
  recipientName?: string;
  countryCode?: string;
  countryNamePt?: string;
  foreignTaxId?: string;
  serviceDescriptionPt?: string;
}): DraftOverrides {
  return {
    ...(options.recipientName
      ? { recipientName: options.recipientName }
      : {}),
    ...(options.countryCode
      ? { countryCode: options.countryCode.toUpperCase() }
      : {}),
    ...(options.countryNamePt
      ? { countryNamePt: options.countryNamePt }
      : {}),
    ...(options.foreignTaxId
      ? { foreignTaxId: options.foreignTaxId }
      : {}),
    ...(options.serviceDescriptionPt
      ? { serviceDescriptionPt: options.serviceDescriptionPt }
      : {}),
  };
}

function parseNonNegativeNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new InvalidArgumentError(`Invalid non-negative number: ${value}`);
  }
  return parsed;
}

async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
