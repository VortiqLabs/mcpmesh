import { createHash, randomBytes } from 'node:crypto';

export type PairingIssueInput = {
  ownerSubject: string;
  deviceName?: string;
  ttlMs?: number;
};

export type PairingRecord = {
  code: string;
  codeHash: string;
  ownerSubject: string;
  deviceId?: string;
  deviceName?: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
};

export type PairingConsumptionInput = {
  deviceId: string;
  ownerSubject: string;
};

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function generateCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';

  while (result.length < length) {
    const index = randomBytes(1).readUInt8(0) % chars.length;
    result += chars[index];
  }

  return result;
}

export class PairingService {
  private readonly codes = new Map<string, PairingRecord>();

  constructor(private readonly ttlMs = 5 * 60 * 1000) {}

  issue(input: PairingIssueInput): PairingRecord {
    const code = generateCode();
    const now = new Date();
    const record: PairingRecord = {
      code,
      codeHash: hashValue(code),
      ownerSubject: input.ownerSubject,
      deviceName: input.deviceName,
      createdAt: now,
      expiresAt: new Date(now.getTime() + (input.ttlMs ?? this.ttlMs)),
    };

    this.codes.set(record.codeHash, record);
    return { ...record };
  }

  consume(code: string, input: PairingConsumptionInput): PairingRecord | null {
    const hashed = hashValue(code);
    const record = this.codes.get(hashed);

    if (!record) {
      return null;
    }

    const now = Date.now();
    if (record.usedAt || record.expiresAt.getTime() <= now) {
      this.codes.delete(hashed);
      return null;
    }

    if (record.ownerSubject !== input.ownerSubject) {
      return null;
    }

    const active: PairingRecord = {
      ...record,
      deviceId: input.deviceId,
      usedAt: new Date(now),
    };

    this.codes.set(hashed, active);
    return active;
  }
}
