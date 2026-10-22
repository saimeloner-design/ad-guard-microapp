-- Uso anónimo de la demo (/demo, docs/SPEC.md §9). `session_id` es un número al azar que vive
-- en la pestaña del navegador (sessionStorage): agrupa lo que hizo una visita, sin saber quién es.
create table demo_events (
  id bigint generated always as identity primary key,
  session_id text not null,
  type text not null,
  at timestamptz not null default now(),
  data jsonb not null default '{}'
);
create index demo_events_at on demo_events (at);
create index demo_events_session on demo_events (session_id, at);
