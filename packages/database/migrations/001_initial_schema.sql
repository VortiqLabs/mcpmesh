CREATE TYPE device_status AS ENUM ('pending', 'active', 'revoked', 'suspended');
CREATE TYPE domain_status AS ENUM ('pending', 'active', 'suspended', 'deleted');

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  owner_subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_subject)
);

CREATE TABLE devices (
  id VARCHAR(128) PRIMARY KEY,
  owner_subject TEXT NOT NULL,
  name TEXT NOT NULL,
  status device_status NOT NULL DEFAULT 'pending',
  credential_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  INDEX idx_devices_owner_subject (owner_subject),
  INDEX idx_devices_status (status)
);

CREATE TABLE domains (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(128) NOT NULL,
  oneauth_domain_id VARCHAR(128) NOT NULL,
  hostname TEXT NOT NULL,
  resource_uri TEXT NOT NULL,
  status domain_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hostname),
  UNIQUE (oneauth_domain_id),
  INDEX idx_domains_device_id (device_id),
  INDEX idx_domains_status (status)
);

CREATE TABLE pairing_codes (
  id SERIAL PRIMARY KEY,
  code_hash TEXT NOT NULL,
  owner_subject TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code_hash),
  INDEX idx_pairing_codes_owner_subject (owner_subject)
);

CREATE TABLE agent_events (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  INDEX idx_agent_events_device_id (device_id),
  INDEX idx_agent_events_event_type (event_type)
);
