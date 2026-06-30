-- migrate:up

create table client_devices (
  id uuid primary key,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table sync_mutations (
  id uuid primary key,
  trip_id uuid references trips(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  client_device_id uuid not null,
  client_mutation_id uuid not null,
  mutation_type text not null,
  base_entity_type text,
  base_entity_id uuid,
  base_entity_version integer,
  payload jsonb not null default '{}'::jsonb,
  status text not null,
  server_entity_id uuid,
  error_code text,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  constraint sync_mutations_status_check check (status in ('applied', 'duplicate', 'conflict', 'rejected')),
  constraint sync_mutations_type_not_blank check (length(trim(mutation_type)) > 0),
  constraint sync_mutations_base_version_positive check (base_entity_version is null or base_entity_version > 0)
);

create unique index sync_mutations_client_unique_idx on sync_mutations(client_device_id, client_mutation_id);
create index sync_mutations_trip_created_idx on sync_mutations(trip_id, created_at);
create index sync_mutations_actor_created_idx on sync_mutations(actor_user_id, created_at);

-- migrate:down

drop table if exists sync_mutations;
drop table if exists client_devices;

