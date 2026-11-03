import { index, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

export const deviceStatusEnum = pgEnum('device_status', ['pending', 'active', 'revoked', 'suspended']);
export const domainStatusEnum = pgEnum('domain_status', ['pending', 'active', 'suspended', 'deleted']);

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    ownerSubject: text('owner_subject').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerSubjectIdx: uniqueIndex('users_owner_subject_idx').on(table.ownerSubject),
  }),
);

export const devices = pgTable(
  'devices',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    ownerSubject: text('owner_subject').notNull(),
    name: text('name').notNull(),
    status: deviceStatusEnum('status').notNull().default('pending'),
    credentialHash: text('credential_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    ownerSubjectIdx: index('devices_owner_subject_idx').on(table.ownerSubject),
    statusIdx: index('devices_status_idx').on(table.status),
  }),
);

export const domains = pgTable(
  'domains',
  {
    id: serial('id').primaryKey(),
    deviceId: varchar('device_id', { length: 128 }).notNull(),
    oneauthDomainId: varchar('oneauth_domain_id', { length: 128 }).notNull(),
    hostname: text('hostname').notNull(),
    resourceUri: text('resource_uri').notNull(),
    status: domainStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    hostnameIdx: uniqueIndex('domains_hostname_idx').on(table.hostname),
    oneauthDomainIdIdx: uniqueIndex('domains_oneauth_domain_id_idx').on(table.oneauthDomainId),
    deviceIdIdx: index('domains_device_id_idx').on(table.deviceId),
    statusIdx: index('domains_status_idx').on(table.status),
  }),
);

export const pairingCodes = pgTable(
  'pairing_codes',
  {
    id: serial('id').primaryKey(),
    codeHash: text('code_hash').notNull(),
    ownerSubject: text('owner_subject').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    codeHashIdx: uniqueIndex('pairing_codes_code_hash_idx').on(table.codeHash),
    ownerSubjectIdx: index('pairing_codes_owner_subject_idx').on(table.ownerSubject),
  }),
);

export const agentEvents = pgTable(
  'agent_events',
  {
    id: serial('id').primaryKey(),
    deviceId: varchar('device_id', { length: 128 }).notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    deviceIdIdx: index('agent_events_device_id_idx').on(table.deviceId),
    eventTypeIdx: index('agent_events_event_type_idx').on(table.eventType),
  }),
);
