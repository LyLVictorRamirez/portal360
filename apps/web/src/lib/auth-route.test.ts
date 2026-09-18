import assert from "node:assert/strict";
import test from "node:test";

import { getLoginUrl, getSafeReturnTo, withReturnTo } from "./auth-route.ts";

test("keeps internal return URLs and rejects external or escaped paths", () => {
  assert.equal(getSafeReturnTo("/proyectos?estado=activo"), "/proyectos?estado=activo");
  assert.equal(getSafeReturnTo(null), "/");
  assert.equal(getSafeReturnTo("https://outside.example"), "/");
  assert.equal(getSafeReturnTo("//outside.example"), "/");
  assert.equal(getSafeReturnTo("/\\outside.example"), "/");
  assert.equal(getSafeReturnTo("/%2f%2foutside.example"), "/");
});

test("builds login and public-flow URLs with a safe return URL", () => {
  assert.equal(
    getLoginUrl("/proyectos?estado=activo"),
    "/login?returnTo=%2Fproyectos%3Festado%3Dactivo",
  );
  assert.equal(getLoginUrl("//outside.example"), "/login");
  assert.equal(
    withReturnTo("/recuperar-contrasena", "/proyectos?estado=activo"),
    "/recuperar-contrasena?returnTo=%2Fproyectos%3Festado%3Dactivo",
  );
  assert.equal(withReturnTo("/registro", "/\\outside.example"), "/registro");
});
