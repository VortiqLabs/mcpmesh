import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  oneAuthOrganizationId: varchar('oneauth_organization_id', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const agents = pgTable('agents', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  oneAuthSubject: varchar('oneauth_subject', { length: 255 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('offline'),
  version: varchar('version', { length: 80 }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('agents_org_idx').on(table.organizationId), uniqueIndex('agents_org_subject_uq').on(table.organizationId, table.oneAuthSubject)]);

export const endpoints = pgTable('endpoints', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  hostname: varchar('hostname', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('endpoints_org_idx').on(table.organizationId), index('endpoints_agent_idx').on(table.agentId)]);

export const gatewayAssignments = pgTable('gateway_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  endpointId: uuid('endpoint_id').notNull().references(() => endpoints.id, { onDelete: 'cascade' }).unique(),
  gatewayId: varchar('gateway_id', { length: 120 }).notNull(),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const routingGrants = pgTable('routing_grants', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  subject: varchar('subject', { length: 255 }).notNull(),
  endpointId: uuid('endpoint_id').notNull().references(() => endpoints.id, { onDelete: 'cascade' }),
  scopes: text('scopes').array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('routing_grants_subject_endpoint_uq').on(table.subject, table.endpointId), index('routing_grants_org_subject_idx').on(table.organizationId, table.subject)]);

export const agentTools = pgTable('agent_tools', {
  id: uuid('id').defaultRandom().primaryKey(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description').notNull().default(''),
  inputSchema: jsonb('input_schema').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('agent_tools_agent_name_uq').on(table.agentId, table.name)]);

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  actorSubject: varchar('actor_subject', { length: 255 }),
  action: varchar('action', { length: 120 }).notNull(),
  resourceType: varchar('resource_type', { length: 80 }),
  resourceId: varchar('resource_id', { length: 255 }),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('audit_events_org_created_idx').on(table.organizationId, table.createdAt)]);
