-- Rocky music app — manual premium subscriptions (admin-verified payments)
-- Run this in Supabase after 0009:  Dashboard → SQL Editor → paste → Run.
--
-- Flow: admin configures the payment method + amount and whether subscriptions
-- are open (payment_settings). A creator sees those details, transfers the money
-- externally, then submits a verification (payments row, status 'pending'). The
-- admin reviews it in the portal; approving grants a month of premium
-- (profiles.premium_until).

-- ── Admin-controlled settings (single row) ────────────────────
create table if not exists public.payment_settings (
  id                 int primary key default 1,
  subscriptions_open boolean not null default false,
  amount             numeric not null default 0,
  currency           text not null default 'USD',
  method             text not null default '',
  instructions       text not null default '',
  updated_at         timestamptz not null default now(),
  constraint payment_settings_singleton check (id = 1)
);
insert into public.payment_settings (id) values (1) on conflict (id) do nothing;

alter table public.payment_settings enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'payment_settings' and policyname = 'Read payment settings') then
    create policy "Read payment settings" on public.payment_settings
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'payment_settings' and policyname = 'Admins update payment settings') then
    create policy "Admins update payment settings" on public.payment_settings
      for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- ── Premium expiry per user ───────────────────────────────────
alter table public.profiles add column if not exists premium_until timestamptz;

-- ── Payment verification submissions ──────────────────────────
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  amount      numeric not null,
  currency    text not null default 'USD',
  method      text,
  reference   text,          -- transaction id / reference the creator entered
  sender_name text,
  note        text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

alter table public.payments enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'payments' and policyname = 'Users insert own payments') then
    create policy "Users insert own payments" on public.payments
      for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'payments' and policyname = 'Read own or admin all payments') then
    create policy "Read own or admin all payments" on public.payments
      for select to authenticated using (user_id = auth.uid() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'payments' and policyname = 'Admins review payments') then
    create policy "Admins review payments" on public.payments
      for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
