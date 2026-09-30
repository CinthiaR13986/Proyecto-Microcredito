-- E2 · Esquema de la cartera (datos canónicos) + metadatos de carga.

create table if not exists asesores (
  id_asesor       text primary key,
  nombre_completo text not null
);

create table if not exists clientes (
  id_cliente      text primary key,
  nombre_completo text not null,
  dpi             text not null,
  telefono        text not null,
  municipio       text not null,
  fecha_alta      date not null
);

create table if not exists creditos (
  id_credito       text primary key,
  id_cliente       text not null references clientes (id_cliente),
  id_asesor        text not null references asesores (id_asesor),
  fecha            date not null,
  capital_centavos bigint not null,
  plazo_meses      int  not null,
  tna_bps          int  not null,
  reestructurado   boolean not null default false,
  politica_mora    text not null
);

-- Bitácora íntegra de pagos (append-only, P1 6.9): los reintentos con clave
-- repetida TAMBIÉN son eventos ocurridos y se conservan. La idempotencia
-- (P1 6.10) se aplica al EFECTO: al reconstruir saldos solo cuenta la
-- primera aparición de cada clave (ver SQL_PAGOS_APLICADOS en cargador.ts).
create table if not exists pagos (
  seq                bigserial primary key,
  clave_idempotencia text not null,
  id_credito         text not null references creditos (id_credito),
  fecha              date not null,
  monto_centavos     bigint not null,
  canal              text not null
);
create index if not exists idx_pagos_clave on pagos (clave_idempotencia, seq);

create table if not exists politicas (
  codigo text primary key,
  datos  jsonb not null
);

create table if not exists carga_meta (
  id              int primary key default 1,
  sha256_eventos  text not null,
  cargado_el      timestamptz not null default now(),
  clientes        int not null,
  creditos        int not null,
  pagos           int not null,
  pagos_aplicados int not null
);