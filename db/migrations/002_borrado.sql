-- Pedidos de borrado de datos que llegan desde Meta (docs/SPEC.md §9). No guarda a quién
-- pertenecían: sólo el código que Meta le muestra al usuario para consultar el estado.
create table deletion_requests (
  confirmation_code text primary key,
  source text not null,                 -- 'data_deletion' (pedido del usuario) | 'deauthorize' (quitó la app)
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
