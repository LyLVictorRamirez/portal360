import { SetMetadata } from "@nestjs/common";

import type { AuthorizationPermission } from "./permissions.js";

export const requiredPermissionsMetadataKey = "authorization:required-permissions";

export function RequirePermissions(...permissions: AuthorizationPermission[]) {
  if (permissions.length === 0) {
    throw new Error("At least one authorization permission is required.");
  }

  return SetMetadata(requiredPermissionsMetadataKey, permissions);
}
