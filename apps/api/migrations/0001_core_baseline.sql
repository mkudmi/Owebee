-- migrate:up

create table users (
  id uuid primary key,
  email text not null unique,
  display_name text not null,
  locale text not null default 'ru',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_locale_check check (locale in ('ru', 'en')),
  constraint users_status_check check (status in ('active', 'disabled')),
  constraint users_email_not_blank check (length(trim(email)) > 0)
);

create table auth_sessions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  session_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint auth_sessions_hash_not_blank check (length(trim(session_hash)) > 0)
);

create index auth_sessions_user_id_idx on auth_sessions(user_id);

create table trips (
  id uuid primary key,
  owner_user_id uuid not null references users(id) on delete restrict,
  name text not null,
  base_currency_code char(3) not null,
  status text not null default 'active',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz,
  constraint trips_status_check check (status in ('active', 'archived', 'deleted')),
  constraint trips_version_positive check (version > 0),
  constraint trips_name_not_blank check (length(trim(name)) > 0),
  constraint trips_base_currency_uppercase check (base_currency_code = upper(base_currency_code))
);

create index trips_owner_status_idx on trips(owner_user_id, status);
create index trips_updated_at_idx on trips(updated_at);

create table trip_invites (
  id uuid primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'active',
  created_by_user_id uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint trip_invites_status_check check (status in ('active', 'revoked')),
  constraint trip_invites_hash_not_blank check (length(trim(token_hash)) > 0)
);

create index trip_invites_trip_status_idx on trip_invites(trip_id, status);

create table trip_members (
  id uuid primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  email text,
  display_name text not null,
  role text not null default 'participant',
  member_type text not null default 'person',
  share_count numeric(12, 4) not null default 1,
  status text not null default 'active',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_members_role_check check (role in ('owner', 'participant')),
  constraint trip_members_type_check check (member_type in ('person', 'family_representative')),
  constraint trip_members_status_check check (status in ('active', 'archived')),
  constraint trip_members_share_count_positive check (share_count > 0),
  constraint trip_members_version_positive check (version > 0),
  constraint trip_members_display_name_not_blank check (length(trim(display_name)) > 0),
  constraint trip_members_owner_has_user check (role <> 'owner' or user_id is not null)
);

create index trip_members_trip_status_idx on trip_members(trip_id, status);
create unique index trip_members_trip_email_unique_idx on trip_members(trip_id, email) where email is not null;

create table audit_events (
  id uuid primary key,
  trip_id uuid references trips(id) on delete set null,
  actor_type text not null,
  actor_id uuid,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_actor_type_check check (actor_type in ('user', 'guest', 'system')),
  constraint audit_events_event_type_not_blank check (length(trim(event_type)) > 0),
  constraint audit_events_entity_type_not_blank check (length(trim(entity_type)) > 0)
);

create index audit_events_trip_created_idx on audit_events(trip_id, created_at);
create index audit_events_type_created_idx on audit_events(event_type, created_at);

-- migrate:down

drop table if exists audit_events;
drop table if exists trip_members;
drop table if exists trip_invites;
drop table if exists trips;
drop table if exists auth_sessions;
drop table if exists users;
