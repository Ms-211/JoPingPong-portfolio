-- 계정 활성/비활성 운영을 사용하지 않는다. 기존 함수명은 이전 migration 및
-- 정책과의 호환을 위해 유지하지만, 권한은 관리자/코치 역할만으로 판단한다.
create or replace function public.is_active_staff()
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
      and role in ('admin'::public.app_role, 'coach'::public.app_role)
  );
$$;

create or replace function public.is_admin()
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
      and role = 'admin'::public.app_role
  );
$$;

create or replace function public.record_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set last_login_at = now()
  where id = (select auth.uid());
end;
$$;

update public.profiles set is_active = true where not is_active;

