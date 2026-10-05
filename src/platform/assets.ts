export function assetUrl(path: string): string {
  return path.replace(/^\/+/, "");
}
