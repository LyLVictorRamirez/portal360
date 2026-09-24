import type { ProjectStatus } from "../../../lib/projects-client";

export function canManageProjectStages(canManageProjects: boolean, status: ProjectStatus): boolean {
  return canManageProjects && status !== "finalized" && status !== "cancelled";
}

export function shouldLoadProjectStages(mode: "create" | "edit" | "view"): boolean {
  return mode === "view";
}
