export type MiddlewareTab = "templates" | "generated";
export type BadgeStatus = "active" | "inactive" | "warning" | "error" | "pending";

export type GeneratedMiddlewareItem = {
  label: string;
  runtimeName: string;
  description: string;
  scope?: "service" | "shared";
  status: BadgeStatus;
  runtimeStatusLabel: string;
};

export { buildGeneratedMiddlewareItems } from "./middlewareGeneratedBuilder";
export { generatedSearchValue } from "./middlewareGeneratedSearch";
export { mapRuntimeStatus } from "./middlewareRuntimeStatus";
