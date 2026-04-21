import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexHtmlPath = path.resolve(__dirname, "../index.html");

test("tick interval select exposes supported speed options", () => {
  const html = readFileSync(indexHtmlPath, "utf8");
  const selectMatch = html.match(/<select id="tickIntervalSelect"[\s\S]*?<\/select>/);

  assert.ok(selectMatch);

  const optionValues = [...selectMatch[0].matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(optionValues, ["0.5", "1", "2", "3", "4"]);
});
