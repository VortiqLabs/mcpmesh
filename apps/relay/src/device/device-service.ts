import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export type DeviceSummary = {
  id: string;
  ownerSubject: string;
  name: string;
  status: 'pending' | 'active' | 'revoked' | 'suspended';
  credentialHash: string;
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
};

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export class DeviceService {
  private readonly devices = new Map<string, DeviceSummary>();

  create(device: DeviceSummary): DeviceSummary {
    this.devices.set(device.id, device);
    return device;
  }

  createCredential(input: { deviceId: string; ownerSubject: string; name: string }): string {
    const existing = this.devices.get(input.deviceId);
    const credential = randomBytes(32).toString('hex');
    const credentialHash = hashValue(credential);

    const now = new Date();
    const nextDevice: DeviceSummary = {
      id: input.deviceId,
      ownerSubject: input.ownerSubject,
      name: input.name,
      status: 'active',
      credentialHash,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      revokedAt: undefined,
    };

    this.devices.set(input.deviceId, nextDevice);
    return credential;
  }

  verifyCredential(deviceId: string, credential: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device || device.status === 'revoked') {
      return false;
    }

    const expected = device.credentialHash;
    const candidate = hashValue(credential);
    return constantTimeEquals(expected, candidate);
  }

  rotateCredential(deviceId: string, newCredential: string): string {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Unknown device: ${deviceId}`);
    }

    const hashed = hashValue(newCredential);
    device.credentialHash = hashed;
    device.updatedAt = new Date();
    device.status = 'active';
    device.revokedAt = undefined;
    return newCredential;
  }

  revoke(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) {
      return false;
    }

    device.status = 'revoked';
    device.revokedAt = new Date();
    device.updatedAt = new Date();
    return true;
  }

  get(deviceId: string): DeviceSummary | undefined {
    return this.devices.get(deviceId);
  }

  list(): DeviceSummary[] {
    return [...this.devices.values()];
  }
}
