-- migrate:up

create table expenses (
  id uuid primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  created_by_member_id uuid not null references trip_members(id) on delete restrict,
  payer_member_id uuid not null references trip_members(id) on delete restrict,
  description text not null,
  expense_date date not null,
  original_amount numeric not null,
  original_currency_code char(3) not null references currencies(code) on delete restrict,
  base_currency_code char(3) not null references currencies(code) on delete restrict,
  converted_amount numeric not null,
  status text not null default 'accepted',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_description_not_blank check (length(trim(description)) > 0),
  constraint expenses_original_amount_positive check (original_amount > 0),
  constraint expenses_converted_amount_positive check (converted_amount > 0),
  constraint expenses_status_check check (status in ('accepted', 'deleted')),
  constraint expenses_version_positive check (version > 0)
);

create index expenses_trip_history_idx
  on expenses(trip_id, expense_date desc, created_at desc, id desc);
create index expenses_creator_idx on expenses(created_by_member_id);
create index expenses_payer_idx on expenses(payer_member_id);

create table expense_splits (
  id uuid primary key,
  expense_id uuid not null references expenses(id) on delete cascade,
  target_type text not null,
  target_member_id uuid references trip_members(id) on delete restrict,
  target_family_id uuid references families(id) on delete restrict,
  share_count numeric not null,
  created_at timestamptz not null default now(),
  constraint expense_splits_target_type_check check (target_type in ('member', 'family')),
  constraint expense_splits_exactly_one_target check (
    (target_member_id is not null and target_family_id is null and target_type = 'member')
    or
    (target_member_id is null and target_family_id is not null and target_type = 'family')
  ),
  constraint expense_splits_share_count_positive check (share_count > 0)
);

create index expense_splits_expense_idx on expense_splits(expense_id);
create unique index expense_splits_member_unique_idx
  on expense_splits(expense_id, target_member_id)
  where target_member_id is not null;
create unique index expense_splits_family_unique_idx
  on expense_splits(expense_id, target_family_id)
  where target_family_id is not null;

create table currency_rate_snapshots (
  id uuid primary key,
  expense_id uuid not null unique references expenses(id) on delete cascade,
  original_currency_code char(3) not null references currencies(code) on delete restrict,
  base_currency_code char(3) not null references currencies(code) on delete restrict,
  rate numeric not null,
  rate_date date not null,
  source text not null,
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  constraint currency_rate_snapshots_rate_positive check (rate > 0),
  constraint currency_rate_snapshots_source_not_blank check (length(trim(source)) > 0)
);

create table expense_idempotency_keys (
  id uuid primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  actor_member_id uuid not null references trip_members(id) on delete cascade,
  key_hash text not null,
  request_fingerprint text not null,
  expense_id uuid not null references expenses(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint expense_idempotency_key_hash_not_blank check (length(trim(key_hash)) > 0),
  constraint expense_idempotency_fingerprint_not_blank check (length(trim(request_fingerprint)) > 0),
  unique (trip_id, actor_member_id, key_hash)
);

create index expense_idempotency_expense_idx on expense_idempotency_keys(expense_id);

-- migrate:down

drop table if exists expense_idempotency_keys;
drop table if exists currency_rate_snapshots;
drop table if exists expense_splits;
drop table if exists expenses;
