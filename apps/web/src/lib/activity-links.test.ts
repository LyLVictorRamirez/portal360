import assert from "node:assert/strict";
import test from "node:test";

import { normalizeActivityLinkUrl } from "./activity-links.ts";

test("accepts only HTTP(S) URLs for Activity links", () => {
  assert.equal(
    normalizeActivityLinkUrl(" https://portal360.test/tarea "),
    "https://portal360.test/tarea",
  );
  assert.equal(normalizeActivityLinkUrl("mailto:soporte@portal360.test"), null);
  assert.equal(normalizeActivityLinkUrl("portal360.test"), null);
});
