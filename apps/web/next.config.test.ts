import assert from "node:assert/strict";
import test from "node:test";

import nextConfig from "./next.config.ts";

test("proxies only Better Auth and authorization API paths to the API origin", async () => {
  const rewrites = await nextConfig.rewrites?.();

  assert.ok(Array.isArray(rewrites));
  assert.deepEqual(
    rewrites.map((rewrite) => rewrite.source),
    ["/api/auth/:path*", "/api/authorization/:path*"],
  );
  assert.match(rewrites[0]?.destination ?? "", /\/api\/auth\/:path\*$/);
  assert.match(rewrites[1]?.destination ?? "", /\/api\/authorization\/:path\*$/);
});
