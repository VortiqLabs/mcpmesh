export type OneAuthTokenClaims = {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat?: number;
  scope?: string;
};
