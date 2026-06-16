import assert from "node:assert/strict";
import test from "node:test";

import {
  renderChecklistMarkdown,
  renderPortalHtml,
  renderSummary,
} from "../src/artifacts.js";
import { newStandaloneDraft } from "../src/draft.js";
import { readinessIssues } from "../src/validation.js";

test("portal HTML escapes values and includes copy controls", () => {
  const draft = newStandaloneDraft(
    { recipientName: '<script>alert("x")</script>' },
    new Date("2026-06-11T12:00:00.000Z"),
  );
  const html = renderPortalHtml(draft, readinessIssues(draft));

  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(html.includes('<script>alert("x")</script>'), false);
  assert.ok(html.includes("data-copy="));
  assert.ok(html.includes("Copy/paste aid only"));
  assert.ok(html.includes("Rascunho incompleto"));
  assert.ok(html.includes("Tomador do Serviço"));
  assert.ok(html.includes("Código de Tributação Nacional"));
  assert.ok(html.includes("Tributação Municipal"));
});

test("checklist and summary expose readiness state", () => {
  const draft = newStandaloneDraft(
    { recipientName: "Example Client" },
    new Date("2026-06-11T12:00:00.000Z"),
  );
  const issues = readinessIssues(draft);
  const checklist = renderChecklistMarkdown(draft, issues);
  const summary = renderSummary(draft, issues);

  assert.ok(checklist.includes("Manually issue through nfse.gov.br"));
  assert.ok(checklist.includes("amounts.brl_amount"));
  assert.ok(summary.includes("Source: standalone"));
  assert.ok(summary.includes("Readiness:"));
});
