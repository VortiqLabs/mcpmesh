export type DeviceStatus = 'pending' | 'active' | 'revoked' | 'suspended';
export type DomainStatus = 'pending' | 'active' | 'suspended' | 'deleted';

export type ResourceDescriptor = {
  kind: 'device' | 'domain' | 'pairing';
  id: string;
  status: DeviceStatus | DomainStatus;
};
