-- migrate:up

create table currencies (
  code char(3) primary key,
  display_name text not null,
  symbol text,
  minor_units integer not null,
  is_active boolean not null default true,
  sort_order integer not null default 1000,
  constraint currencies_code_uppercase check (code = upper(code)),
  constraint currencies_display_name_not_blank check (length(trim(display_name)) > 0),
  constraint currencies_minor_units_range check (minor_units >= 0 and minor_units <= 4)
);

insert into currencies (code, display_name, symbol, minor_units, sort_order)
values
  ('EUR', 'Euro', null, 2, 10),
  ('USD', 'US Dollar', null, 2, 20),
  ('RUB', 'Russian Ruble', null, 2, 30),
  ('GBP', 'Pound Sterling', null, 2, 40),
  ('CHF', 'Swiss Franc', null, 2, 50),
  ('GEL', 'Georgian Lari', null, 2, 60),
  ('AMD', 'Armenian Dram', null, 2, 70),
  ('AZN', 'Azerbaijani Manat', null, 2, 80),
  ('KZT', 'Kazakhstani Tenge', null, 2, 90),
  ('KGS', 'Kyrgyzstani Som', null, 2, 100),
  ('UZS', 'Uzbekistani Som', null, 2, 110),
  ('TJS', 'Tajikistani Somoni', null, 2, 120),
  ('BYN', 'Belarusian Ruble', null, 2, 130),
  ('UAH', 'Ukrainian Hryvnia', null, 2, 140),
  ('MDL', 'Moldovan Leu', null, 2, 150),
  ('PLN', 'Polish Zloty', null, 2, 160),
  ('CZK', 'Czech Koruna', null, 2, 170),
  ('HUF', 'Hungarian Forint', null, 2, 180),
  ('RON', 'Romanian Leu', null, 2, 190),
  ('BGN', 'Bulgarian Lev', null, 2, 200),
  ('TRY', 'Turkish Lira', null, 2, 210),
  ('SEK', 'Swedish Krona', null, 2, 220),
  ('NOK', 'Norwegian Krone', null, 2, 230),
  ('DKK', 'Danish Krone', null, 2, 240),
  ('ISK', 'Icelandic Krona', null, 0, 250),
  ('RSD', 'Serbian Dinar', null, 2, 260),
  ('ALL', 'Albanian Lek', null, 2, 270),
  ('MKD', 'Macedonian Denar', null, 2, 280),
  ('BAM', 'Bosnia and Herzegovina Convertible Mark', null, 2, 290);

alter table trips
  add constraint trips_base_currency_code_fk
  foreign key (base_currency_code) references currencies(code) on delete restrict;

create unique index trips_owner_active_name_unique_idx
  on trips(owner_user_id, lower(name))
  where status = 'active';

create table guest_sessions (
  id uuid primary key,
  trip_member_id uuid not null references trip_members(id) on delete cascade,
  session_hash text not null unique,
  device_label text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  constraint guest_sessions_hash_not_blank check (length(trim(session_hash)) > 0)
);

create index guest_sessions_member_idx on guest_sessions(trip_member_id);

create table families (
  id uuid primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  display_name text not null,
  share_count numeric not null,
  status text not null default 'active',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint families_display_name_not_blank check (length(trim(display_name)) > 0),
  constraint families_share_count_positive check (share_count > 0),
  constraint families_status_check check (status in ('active', 'archived')),
  constraint families_version_positive check (version > 0)
);

create index families_trip_status_idx on families(trip_id, status);
create unique index families_trip_active_name_unique_idx
  on families(trip_id, lower(display_name))
  where status = 'active';

-- migrate:down

drop table if exists families;
drop table if exists guest_sessions;
drop index if exists trips_owner_active_name_unique_idx;
alter table trips drop constraint if exists trips_base_currency_code_fk;
drop table if exists currencies;
