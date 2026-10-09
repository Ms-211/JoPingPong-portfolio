-- Normalize legacy/demo rows that have no remaining lessons but are still active.
select set_config('app.audit_reason', '소진 활성권 상태 정리', true);

update public.lesson_passes
set status = 'exhausted'::public.lesson_pass_status
where status = 'active'::public.lesson_pass_status
  and used_count >= total_count;

-- If a normalized member already has a waiting pass, activate the oldest one.
with next_pending as (
  select distinct on (member_id) id
  from public.lesson_passes as candidate
  where candidate.status = 'pending'::public.lesson_pass_status
    and not exists (
      select 1
      from public.lesson_passes as active_pass
      where active_pass.member_id = candidate.member_id
        and active_pass.status = 'active'::public.lesson_pass_status
    )
  order by member_id, paid_at, created_at, id
)
update public.lesson_passes as lesson_pass
set
  status = 'active'::public.lesson_pass_status,
  start_date = coalesce(lesson_pass.start_date, public.business_date())
from next_pending
where lesson_pass.id = next_pending.id;

create or replace function public.register_lesson_pass(
  p_member_id uuid,
  p_paid_at date,
  p_paid_amount numeric,
  p_payment_method text,
  p_memo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pass_id uuid;
  v_next_pass_id uuid;
  v_status public.lesson_pass_status;
begin
  if not (select public.is_admin()) then
    raise exception '관리자만 레슨권을 등록할 수 있습니다.' using errcode = '42501';
  end if;

  if p_paid_at is null
    or p_paid_amount is null
    or p_paid_amount < 0
    or nullif(trim(p_payment_method), '') is null then
    raise exception '결제 정보를 확인해 주세요.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.members where id = p_member_id) then
    raise exception '회원을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_member_id::text, 0));

  perform set_config('app.audit_reason', '레슨권 등록 전 소진 상태 정리', true);
  update public.lesson_passes
  set status = 'exhausted'::public.lesson_pass_status
  where member_id = p_member_id
    and status = 'active'::public.lesson_pass_status
    and used_count >= total_count;

  if not exists (
    select 1 from public.lesson_passes
    where member_id = p_member_id
      and status = 'active'::public.lesson_pass_status
  ) then
    select id into v_next_pass_id
    from public.lesson_passes
    where member_id = p_member_id
      and status = 'pending'::public.lesson_pass_status
    order by paid_at, created_at, id
    limit 1
    for update;

    if v_next_pass_id is not null then
      update public.lesson_passes
      set
        status = 'active'::public.lesson_pass_status,
        start_date = coalesce(start_date, public.business_date())
      where id = v_next_pass_id;
    end if;
  end if;

  if exists (
    select 1
    from public.lesson_passes
    where member_id = p_member_id
      and status = 'active'::public.lesson_pass_status
      and used_count < total_count
  ) then
    v_status := 'pending'::public.lesson_pass_status;
  else
    v_status := 'active'::public.lesson_pass_status;
  end if;

  perform set_config('app.audit_reason', '레슨권 등록', true);
  insert into public.lesson_passes (
    member_id, product_name, total_count, used_count, start_date,
    paid_at, paid_amount, payment_method, status, created_by, memo
  ) values (
    p_member_id, '8회 레슨권', 8, 0,
    case when v_status = 'active' then p_paid_at else null end,
    p_paid_at, p_paid_amount, trim(p_payment_method), v_status,
    (select auth.uid()), nullif(trim(p_memo), '')
  ) returning id into v_pass_id;

  return v_pass_id;
end;
$$;
