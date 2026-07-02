export type RollbackResourceType = "settings" | "service" | "redirect" | "middleware" | "user";

const rollbackResourceTypes = ["settings", "service", "redirect", "middleware", "user"];

export function isRollbackResourceType(value: string): value is RollbackResourceType {
  return rollbackResourceTypes.includes(value);
}
