import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { PACKAGE_VERSION } from "../src/version.js";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

test("prints help and package version", async () => {
  const help = await runCli(["--help"]);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /Usage: notaflow/);
  assert.match(help.stdout, /from-invoice\|init/);

  const version = await runCli(["--version"]);
  assert.equal(version.code, 0);
  assert.equal(version.stdout.trim(), PACKAGE_VERSION);
});

test("creates and validates a standalone draft", async () => {
  const directory = await makeTempDirectory();
  const draftFile = path.join(directory, "standalone.yml");

  const created = await runCli([
    "new",
    draftFile,
    "--recipient-name",
    "Example Client",
    "--country-code",
    "gb",
    "--country-name-pt",
    "Reino Unido",
    "--currency",
    "usd",
    "--amount",
    "7000",
  ]);

  assert.equal(created.code, 0, created.stderr);
  assert.match(created.stdout, /Created/);
  await assertFileExists(draftFile);

  const draft = await readFile(draftFile, "utf8");
  assert.match(draft, /country_code: "GB"/);
  assert.match(draft, /original_currency: "USD"/);

  const validated = await runCli(["validate", draftFile, "--allow-incomplete"]);
  assert.equal(validated.code, 0, validated.stderr);
  assert.match(validated.stdout, /Schema valid: nfse_draft\.v1/);
});

test("imports an invoice and prints a summary", async () => {
  const directory = await makeTempDirectory();
  const draftFile = path.join(directory, "from-invoice.yml");

  const imported = await runCli([
    "from-invoice",
    "examples/invoice.yml",
    "--invoice-format",
    "simple-invoice.v1",
    "--out",
    draftFile,
    "--country-code",
    "GB",
    "--country-name-pt",
    "Reino Unido",
  ]);

  assert.equal(imported.code, 0, imported.stderr);
  await assertFileExists(draftFile);

  const summary = await runCli(["summary", draftFile]);
  assert.equal(summary.code, 0, summary.stderr);
  assert.match(summary.stdout, /Source: INV-202606/);
  assert.match(summary.stdout, /Recipient: Example Client Ltd/);
});

test("generates public artifacts from the completed example", async () => {
  const directory = await makeTempDirectory();
  const dpsFile = path.join(directory, "dps.xml");
  const portalFile = path.join(directory, "portal.html");
  const checklistFile = path.join(directory, "checklist.md");

  const dps = await runCli([
    "dps",
    "examples/nfse-draft.yml",
    "--out",
    dpsFile,
  ]);
  assert.equal(dps.code, 0, dps.stderr);
  await assertFileExists(dpsFile);

  const portal = await runCli([
    "portal",
    "examples/nfse-draft.yml",
    "--out",
    portalFile,
  ]);
  assert.equal(portal.code, 0, portal.stderr);
  await assertFileExists(portalFile);

  const checklist = await runCli([
    "checklist",
    "examples/nfse-draft.yml",
    "--out",
    checklistFile,
  ]);
  assert.equal(checklist.code, 0, checklist.stderr);
  await assertFileExists(checklistFile);
});

test("invalid numeric options report a concise CLI error", async () => {
  const directory = await makeTempDirectory();
  const draftFile = path.join(directory, "invalid.yml");
  const result = await runCli(["new", draftFile, "--amount", "abc"]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Invalid non-negative number: abc/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

async function runCli(args: string[]): Promise<CliResult> {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "src/cli.ts", ...args],
    {
      cwd: projectRoot,
      env: { ...process.env, NO_COLOR: "1" },
    },
  );

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  return { code, stdout, stderr };
}

async function makeTempDirectory(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "notaflow-cli-"));
}

async function assertFileExists(file: string): Promise<void> {
  const result = await stat(file);
  assert.equal(result.isFile(), true);
}
