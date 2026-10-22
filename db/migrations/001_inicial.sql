-- Esquema inicial (docs/SPEC.md §9). Las claves son los IDs de Meta: así cada guardado es
-- un upsert directo, sin buscar IDs internos antes.

create table users (
  meta_user_id text primary key,        -- ID de Meta para esta app (token.sub de next-auth)
  email text,
  first_device text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table ad_accounts (
  meta_account_id text primary key,     -- sin el prefijo act_
  currency text,
  timezone text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table user_ad_accounts (
  meta_user_id text not null references users on delete cascade,
  meta_account_id text not null references ad_accounts on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (meta_user_id, meta_account_id)
);
create index user_ad_accounts_account on user_ad_accounts (meta_account_id);

-- Un registro por cuenta y día (en la zona horaria de la cuenta); cada recarga lo sobrescribe.
create table account_days (
  meta_account_id text not null references ad_accounts on delete cascade,
  day date not null,
  campaigns integer not null,
  active_count integer not null,
  alert_count integer not null,
  total_cost numeric,
  potential_savings numeric,
  account_alerts text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (meta_account_id, day)
);

-- Calibración (§7): métricas de 30 días de cada campaña y qué alertas salieron.
-- Lo que no se filtra ni agrupa va en `metrics`.
create table campaign_days (
  meta_campaign_id text not null,
  day date not null,
  meta_account_id text not null references ad_accounts on delete cascade,
  status text,
  objective text,
  result_type text,
  cost numeric,
  impressions bigint,
  results numeric,
  cost_per_result numeric,
  learning boolean,
  alerts text[] not null default '{}',
  metrics jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (meta_campaign_id, day)
);
create index campaign_days_account_day on campaign_days (meta_account_id, day);

-- Análisis en sombra (§7): concentración del gasto perdido por nivel (adset, ad).
create table shadow_days (
  meta_campaign_id text not null,
  day date not null,
  level text not null,
  meta_account_id text not null references ad_accounts on delete cascade,
  measured boolean not null,
  campaign_alerts text[] not null default '{}',
  campaign_flagged_pause boolean not null,
  parts integer not null,
  parts_with_spend integer not null,
  wasted_parts integer,
  wasted_share numeric,
  top1_wasted_share numeric,
  top2_wasted_share numeric,
  updated_at timestamptz not null default now(),
  primary key (meta_campaign_id, day, level)
);
create index shadow_days_account_day on shadow_days (meta_account_id, day);

create table account_settings (
  meta_user_id text not null references users on delete cascade,
  meta_account_id text not null references ad_accounts on delete cascade,
  profit_per_sale numeric,
  updated_at timestamptz not null default now(),
  primary key (meta_user_id, meta_account_id)
);

-- Acciones del usuario: pausar, activar, copiar, guardias, tope de gasto, tareas hechas, login.
create table events (
  id bigint generated always as identity primary key,
  meta_user_id text references users on delete cascade,
  meta_account_id text references ad_accounts on delete cascade,
  meta_campaign_id text,
  type text not null,
  at timestamptz not null default now(),
  data jsonb not null default '{}'
);
create index events_user_at on events (meta_user_id, at);
create index events_account_type_at on events (meta_account_id, type, at);
