create table if not exists public.seo_user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  role text not null check (role in ('viewer', 'editor', 'admin')),
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_seo_user_roles_role on public.seo_user_roles (role);
create index if not exists idx_seo_user_roles_email on public.seo_user_roles (email);

alter table public.seo_user_roles enable row level security;

create policy "user_roles_select_own"
  on public.seo_user_roles
  for select
  to authenticated
  using (auth.uid() = user_id);

comment on table public.seo_user_roles is '应用层角色权限表：viewer / editor / admin';
