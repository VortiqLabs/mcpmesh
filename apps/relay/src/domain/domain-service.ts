export type DomainStatus = 'pending' | 'active' | 'suspended' | 'deleted';

export type DomainRecord = {
  id: string;
  deviceId: string;
  hostname: string;
  status: DomainStatus;
};

export class DomainService {
  private readonly domains = new Map<string, DomainRecord>();

  register(record: DomainRecord): DomainRecord {
    this.domains.set(record.hostname, record);
    return record;
  }

  getByHostname(hostname: string): DomainRecord | undefined {
    return this.domains.get(hostname);
  }
}
