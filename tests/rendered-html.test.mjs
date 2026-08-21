import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { POST as scoreLead } from "../app/api/lead-score/route.ts";
import { POST as searchLiterature } from "../app/api/literature/route.ts";

test("defines the BioDiscovery product experience", async () => {
  const [pageSource, layoutSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(pageSource, /From research question to/);
  assert.match(pageSource, /Build a workflow/);
  assert.match(layoutSource, /Workflow Planner/);
});

test("scores a qualified prototype inquiry without persistence", async () => {
  const response = await scoreLead(new Request("http://localhost/api/lead-score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "scientist@example.org",
      organization: "Example Research Institute",
      role: "Computational scientist",
      teamSize: "5-20",
      timeline: "quarter",
      useCase: "Evaluate a screening workflow for an oncology target.",
    }),
  }));

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.prototype, true);
  assert.equal(payload.segment, "Priority demo");
  assert.ok(payload.score >= 60);
});

test("validates literature queries before contacting the upstream API", async () => {
  const response = await searchLiterature(new Request("http://localhost/api/literature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "x" }),
  }));
  assert.equal(response.status, 400);
});
