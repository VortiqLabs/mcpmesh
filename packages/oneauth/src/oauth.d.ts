import { type JWK } from 'jose';
import type { OneAuthTokenClaims } from './types.js';
export type OneAuthValidationOptions = {
    issuer?: string;
    expectedAudience?: string;
    resource?: string;
    requiredScopes?: string[];
    jwks?: {
        keys: JWK[];
    };
    jwksUri?: string;
};
export declare function isValidAudience(audience: string | string[] | undefined, expected: string): boolean;
export declare function normalizeScopes(scope: string | string[] | undefined): string[];
export declare function verifyOneAuthToken(token: string, options?: OneAuthValidationOptions): Promise<OneAuthTokenClaims>;
//# sourceMappingURL=oauth.d.ts.map