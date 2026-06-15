create extension if not exists "pgcrypto";

create table if not exists compositions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text,
  code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists compositions_updated_at_idx
  on compositions (updated_at desc);
