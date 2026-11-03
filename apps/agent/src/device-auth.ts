export function isValidDeviceToken(token: string): boolean {
  return token.length > 12;
}
