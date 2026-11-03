import { describe, expect, it } from 'vitest';
import { DeviceService } from '../apps/relay/src/device/device-service.ts';
import { PairingService } from '../apps/relay/src/pairing.ts';

describe('phase 6 pairing and device lifecycle', () => {
  it('issues a single-use pairing code and validates it once', () => {
    const pairing = new PairingService();
    const issued = pairing.issue({ ownerSubject: 'user_123', deviceName: 'Laptop' });

    expect(issued.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const valid = pairing.consume(issued.code, { deviceId: 'device_abc', ownerSubject: 'user_123' });
    expect(valid).toMatchObject({ ownerSubject: 'user_123', deviceId: 'device_abc', code: issued.code });

    const reused = pairing.consume(issued.code, { deviceId: 'device_abc', ownerSubject: 'user_123' });
    expect(reused).toBeNull();
  });

  it('creates a hashed credential and rotates or revokes it', () => {
    const service = new DeviceService();
    const credential = service.createCredential({
      deviceId: 'device_abc',
      ownerSubject: 'user_123',
      name: 'Laptop',
    });

    expect(service.verifyCredential('device_abc', credential)).toBe(true);
    expect(service.verifyCredential('device_abc', 'wrong-secret')).toBe(false);

    const rotated = service.rotateCredential('device_abc', 'new-secret-456');
    expect(service.verifyCredential('device_abc', rotated)).toBe(true);
    expect(service.verifyCredential('device_abc', credential)).toBe(false);

    expect(service.revoke('device_abc')).toBe(true);
    expect(service.verifyCredential('device_abc', rotated)).toBe(false);
  });
});
