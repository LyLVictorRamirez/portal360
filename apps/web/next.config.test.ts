import assert from "node:assert/strict";
import test from "node:test";

import nextConfig from "./next.config.ts";

test("proxies only the configured API paths to the API origin", async () => {
  const rewrites = await nextConfig.rewrites?.();

  assert.ok(Array.isArray(rewrites));
  assert.deepEqual(
    rewrites.map((rewrite) => rewrite.source),
    [
      "/api/auth/:path*",
      "/api/authorization/:path*",
      "/api/clients/:path*",
      "/api/projects/:path*",
      "/api/requirements/:path*",
      "/api/tickets/:path*",
      "/api/activities/:path*",
      "/api/activity-categories/:path*",
    ],
  );
  assert.match(rewrites[0]?.destination ?? "", /\/api\/auth\/:path\*$/);
  assert.match(rewrites[1]?.destination ?? "", /\/api\/authorization\/:path\*$/);
  assert.match(rewrites[2]?.destination ?? "", /\/api\/clients\/:path\*$/);
  assert.match(rewrites[3]?.destination ?? "", /\/api\/projects\/:path\*$/);
  assert.match(rewrites[4]?.destination ?? "", /\/api\/requirements\/:path\*$/);
  assert.match(rewrites[5]?.destination ?? "", /\/api\/tickets\/:path\*$/);
  assert.match(rewrites[6]?.destination ?? "", /\/api\/activities\/:path\*$/);
  assert.match(rewrites[7]?.destination ?? "", /\/api\/activity-categories\/:path\*$/);
});
