import assert from "node:assert/strict";
import test from "node:test";

import { normalizeActivityDescription } from "./activity-description.js";

test("normalizes the supported Activity rich text document", () => {
  assert.deepEqual(
    normalizeActivityDescription({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Entrega " },
            { type: "text", marks: [{ type: "bold" }], text: "prioritaria" },
          ],
        },
      ],
    }),
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Entrega ", marks: undefined },
            { type: "text", text: "prioritaria", marks: [{ type: "bold" }] },
          ],
        },
      ],
    },
  );
});

test("normalizes the paragraph and lists document emitted by the Activity editor", () => {
  assert.deepEqual(
    normalizeActivityDescription({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              marks: [{ type: "bold" }, { type: "underline" }],
              text: "Actividad 1",
            },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "Esta es una actividad" }] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Punto 1" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Punto 2" }] }],
            },
          ],
        },
        {
          attrs: { start: 1, type: null },
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Paso 1" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Paso 2" }] }],
            },
          ],
        },
      ],
    }),
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              marks: [{ type: "bold" }, { type: "underline" }],
              text: "Actividad 1",
            },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", marks: undefined, text: "Esta es una actividad" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", marks: undefined, text: "Punto 1" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", marks: undefined, text: "Punto 2" }],
                },
              ],
            },
          ],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", marks: undefined, text: "Paso 1" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", marks: undefined, text: "Paso 2" }],
                },
              ],
            },
          ],
        },
      ],
    },
  );
});

test("accepts the empty trailing paragraph emitted after rich text lists", () => {
  assert.deepEqual(
    normalizeActivityDescription({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Actividad" }] },
        { type: "paragraph" },
      ],
    }),
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", marks: undefined, text: "Actividad" }],
        },
        { type: "paragraph", content: [] },
      ],
    },
  );
});

test("rejects unsafe links and content outside the Activity rich text toolbar", () => {
  assert.throws(() =>
    normalizeActivityDescription({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
              text: "Abrir",
            },
          ],
        },
      ],
    }),
  );
  assert.throws(() => normalizeActivityDescription({ type: "doc", content: [{ type: "image" }] }));
});
