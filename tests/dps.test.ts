import assert from "node:assert/strict";
import test from "node:test";

import { newStandaloneDraft } from "../src/draft.js";
import { generateDpsXml } from "../src/dps.js";
import { validateDraftFile } from "../src/validation.js";

test("generates schema-valid DPS XML from the completed example draft", async () => {
  const result = await validateDraftFile("examples/nfse-draft.yml");
  assert.deepEqual(result.schemaErrors, []);
  assert.ok(result.draft);
  assert.deepEqual(
    result.readiness.filter((issue) => issue.severity === "error"),
    [],
  );

  const generated = await generateDpsXml(result.draft);

  assert.deepEqual(generated.issues, []);
  assert.ok(generated.xml);
  assert.match(generated.xml, /<DPS /);
  assert.match(generated.xml, /versao="1\.01"/);
  assert.match(generated.xml, /<comExt>/);
  assert.match(generated.xml, /<cPaisResult>GB<\/cPaisResult>/);
});

test("reports missing DPS inputs before attempting XML generation", async () => {
  const draft = newStandaloneDraft({}, new Date("2026-06-11T12:00:00.000Z"));

  const generated = await generateDpsXml(draft);

  assert.equal(generated.xml, null);
  assert.ok(
    generated.issues.some((issue) => issue.path === "provider.cnpj"),
  );
  assert.ok(
    generated.issues.some((issue) => issue.path === "dps.environment"),
  );
});
