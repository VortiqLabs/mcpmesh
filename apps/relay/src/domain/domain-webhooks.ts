export type DomainWebhookPayload = {
  type: 'domain.created' | 'domain.updated' | 'domain.deleted';
  domainId: string;
  hostname: string;
  status: string;
};

export function validateDomainWebhook(payload: unknown): DomainWebhookPayload | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;

  if (typeof candidate.type !== 'string' || typeof candidate.domainId !== 'string' || typeof candidate.hostname !== 'string') {
    return null;
  }

  return {
    type: candidate.type as DomainWebhookPayload['type'],
    domainId: candidate.domainId,
    hostname: candidate.hostname,
    status: typeof candidate.status === 'string' ? candidate.status : 'unknown',
  };
}
