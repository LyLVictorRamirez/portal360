import assert from "node:assert/strict";
import test from "node:test";

import { activityDescriptionText, isActivityDescription } from "./activity-description.ts";

test("recognizes the Activity rich text document and extracts visible text", () => {
  const description = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Entrega " },
          { type: "text", text: "lista" },
        ],
      },
    ],
  } as const;

  assert.equal(isActivityDescription(description), true);
  assert.equal(activityDescriptionText(description), "Entrega lista");
});

test("does not recognize an Activity description without a document root", () => {
  assert.equal(isActivityDescription({ type: "paragraph", content: [] }), false);
});

test("treats a partial document as empty while the editor initializes", () => {
  const partialDocument = { type: "doc" } as unknown as Parameters<
    typeof activityDescriptionText
  >[0];

  assert.equal(activityDescriptionText(partialDocument), "");
  assert.equal(isActivityDescription(partialDocument), false);
});
