export function toGeneratedMiddlewareSafeName(domain: string) {
  return domain.replaceAll(".", "-").replaceAll("_", "-");
}
