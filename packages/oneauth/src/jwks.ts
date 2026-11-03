export type JsonWebKeyLike = {
  kid?: string;
  alg?: string;
  use?: string;
  kty?: string;
};

export const emptyJwks: { keys: JsonWebKeyLike[] } = {
  keys: [],
};
