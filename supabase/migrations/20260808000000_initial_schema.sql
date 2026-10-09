create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('admin', 'coach');
create type public.member_status as enum ('active', 'paused', 'ended');
create type public.lesson_pass_status as enum (
  'pending',
  'active',
  'exhausted',
  'expired',
  'cancelled'
);
create type public.lesson_record_status as enum (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);
create type public.lesson_request_method as enum (
  'qr',
  'coach_manual',
  'outage_recovery'
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  role public.app_role not null default 'coach',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, '운영자'), '@', 1)
    ),
    'coach'::public.app_role
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_active
      and role in ('admin'::public.app_role, 'coach'::public.app_role)
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_active
      and role = 'admin'::public.app_role
  );
$$;

create function public.record_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set last_login_at = now()
  where id = (select auth.uid())
    and is_active;
end;
$$;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  photo_path text,
  fixed_weekdays smallint[] not null default '{}',
  status public.member_status not null default 'active',
  pause_start_date date,
  pause_end_date date,
  memo text,
  important_memo text,
  joined_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_fixed_weekdays_valid check (
    fixed_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  ),
  constraint members_pause_range_valid check (
    pause_start_date is null
    or pause_end_date is null
    or pause_start_date <= pause_end_date
  )
);

comment on column public.members.fixed_weekdays is
  'ISO weekday codes 1 (Monday) through 7 (Sunday). Reference information only.';

create table public.member_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  token_hash text not null unique check (length(token_hash) >= 64),
  is_active boolean not null default true,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  issued_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_qr_revocation_consistent check (
    (is_active and revoked_at is null)
    or (not is_active and revoked_at is not null and length(trim(revoked_reason)) > 0)
  )
);

create unique index member_qr_tokens_one_active_per_member
on public.member_qr_tokens(member_id)
where is_active;

create table public.lesson_passes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  product_name text not null default '8회 레슨권',
  total_count smallint not null default 8,
  used_count smallint not null default 0,
  start_date date,
  paid_at date not null,
  expires_at date generated always as (
    (paid_at + interval '2 months' - interval '1 day')::date
  ) stored,
  paid_amount numeric(12, 2) not null check (paid_amount >= 0),
  payment_method text not null check (length(trim(payment_method)) > 0),
  status public.lesson_pass_status not null default 'pending',
  created_by uuid not null references public.profiles(id),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_passes_fixed_total check (total_count = 8),
  constraint lesson_passes_used_count_valid check (
    used_count between 0 and total_count
  )
);

comment on column public.lesson_passes.expires_at is
  'Last valid date, calculated inclusively as paid_at + 2 calendar months - 1 day.';

create unique index lesson_passes_one_active_per_member
on public.lesson_passes(member_id)
where status = 'active';

create table public.lesson_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  lesson_pass_id uuid references public.lesson_passes(id),
  actual_coach_id uuid references public.profiles(id),
  request_method public.lesson_request_method not null,
  requested_at timestamptz not null default now(),
  lesson_date date not null default current_date,
  daily_sequence smallint,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  status public.lesson_record_status not null default 'pending',
  deducted_count smallint not null default 0,
  rejected_at timestamptz,
  rejected_by uuid references public.profiles(id),
  rejection_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancellation_reason text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_records_daily_sequence_valid check (
    daily_sequence is null or daily_sequence in (1, 2)
  ),
  constraint lesson_records_deduction_valid check (
    deducted_count in (0, 1)
  ),
  constraint lesson_records_approved_fields check (
    status <> 'approved'
    or (
      lesson_pass_id is not null
      and actual_coach_id is not null
      and approved_at is not null
      and approved_by is not null
      and daily_sequence is not null
      and deducted_count = 1
    )
  ),
  constraint lesson_records_rejected_fields check (
    status <> 'rejected'
    or (rejected_at is not null and rejected_by is not null)
  ),
  constraint lesson_records_cancelled_fields check (
    status <> 'cancelled'
    or (
      cancelled_at is not null
      and cancelled_by is not null
      and length(trim(cancellation_reason)) > 0
      and deducted_count = 0
    )
  )
);

create unique index lesson_records_one_pending_per_member
on public.lesson_records(member_id)
where status = 'pending';

create unique index lesson_records_two_daily_approvals
on public.lesson_records(member_id, lesson_date, daily_sequence)
where status = 'approved';

comment on column public.lesson_records.daily_sequence is
  'Approved lesson slot 1 or 2. A transaction assigns the first available slot.';

create table public.pass_adjustments (
  id uuid primary key default gen_random_uuid(),
  lesson_pass_id uuid not null references public.lesson_passes(id),
  adjustment_count smallint not null check (adjustment_count <> 0),
  reason text not null check (length(trim(reason)) > 0),
  adjusted_by uuid not null references public.profiles(id),
  adjusted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (length(trim(entity_type)) > 0),
  entity_id uuid not null,
  action text not null check (length(trim(action)) > 0),
  before_data jsonb,
  after_data jsonb,
  reason text,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index members_name_idx on public.members(name);
create index members_status_idx on public.members(status);
create index lesson_passes_member_id_idx on public.lesson_passes(member_id);
create index lesson_records_lesson_date_idx on public.lesson_records(lesson_date);
create index lesson_records_member_id_idx on public.lesson_records(member_id);
create index lesson_records_actual_coach_id_idx on public.lesson_records(actual_coach_id);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_updated_at();
create trigger member_qr_tokens_set_updated_at
before update on public.member_qr_tokens
for each row execute function public.set_updated_at();
create trigger lesson_passes_set_updated_at
before update on public.lesson_passes
for each row execute function public.set_updated_at();
create trigger lesson_records_set_updated_at
before update on public.lesson_records
for each row execute function public.set_updated_at();
create trigger pass_adjustments_set_updated_at
before update on public.pass_adjustments
for each row execute function public.set_updated_at();
create trigger audit_logs_set_updated_at
before update on public.audit_logs
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.member_qr_tokens enable row level security;
alter table public.lesson_passes enable row level security;
alter table public.lesson_records enable row level security;
alter table public.pass_adjustments enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own_or_admin
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_admin_insert
on public.profiles for insert to authenticated
with check ((select public.is_admin()));

create policy profiles_admin_update
on public.profiles for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy members_staff_select
on public.members for select to authenticated
using ((select public.is_active_staff()));

create policy members_admin_insert
on public.members for insert to authenticated
with check ((select public.is_admin()));

create policy members_admin_update
on public.members for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy member_qr_tokens_staff_select
on public.member_qr_tokens for select to authenticated
using ((select public.is_active_staff()));

create policy member_qr_tokens_admin_insert
on public.member_qr_tokens for insert to authenticated
with check ((select public.is_admin()));

create policy member_qr_tokens_admin_update
on public.member_qr_tokens for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy lesson_passes_staff_select
on public.lesson_passes for select to authenticated
using ((select public.is_active_staff()));

create policy lesson_passes_admin_insert
on public.lesson_passes for insert to authenticated
with check ((select public.is_admin()));

create policy lesson_passes_admin_update
on public.lesson_passes for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy lesson_records_staff_select
on public.lesson_records for select to authenticated
using ((select public.is_active_staff()));

create policy pass_adjustments_admin_select
on public.pass_adjustments for select to authenticated
using ((select public.is_admin()));

create policy pass_adjustments_admin_insert
on public.pass_adjustments for insert to authenticated
with check ((select public.is_admin()));

create policy audit_logs_admin_select
on public.audit_logs for select to authenticated
using ((select public.is_admin()));

revoke all on function public.is_active_staff() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.record_login() from public, anon;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.record_login() to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.members to authenticated;
grant select, insert, update on public.member_qr_tokens to authenticated;
grant select, insert, update on public.lesson_passes to authenticated;
grant select on public.lesson_records to authenticated;
grant select, insert on public.pass_adjustments to authenticated;
grant select on public.audit_logs to authenticated;

