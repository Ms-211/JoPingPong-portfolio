create function public.register_past_lesson(
  p_member_id uuid,
  p_lesson_date date,
  p_actual_coach_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record_id uuid;
  v_pass public.lesson_passes;
  v_next_pass_id uuid;
  v_daily_sequence smallint;
  v_new_used_count smallint;
begin
  if not (select public.is_admin()) then
    raise exception '관리자만 과거 레슨을 등록할 수 있습니다.' using errcode = '42501';
  end if;

  if p_lesson_date is null or p_lesson_date > public.business_date() then
    raise exception '레슨일은 오늘 또는 과거 날짜여야 합니다.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.members where id = p_member_id) then
    raise exception '회원을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_actual_coach_id
      and is_active
      and role in ('admin'::public.app_role, 'coach'::public.app_role)
  ) then
    raise exception '활성 관리자 또는 코치를 선택해 주세요.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_member_id::text, 1));

  select candidate::smallint into v_daily_sequence
  from generate_series(1, 2) as candidate
  where not exists (
    select 1 from public.lesson_records approved
    where approved.member_id = p_member_id
      and approved.lesson_date = p_lesson_date
      and approved.status = 'approved'::public.lesson_record_status
      and approved.daily_sequence = candidate
  )
  order by candidate
  limit 1;

  if v_daily_sequence is null then
    raise exception '해당 날짜에 이미 2회 레슨이 등록되어 있습니다.' using errcode = '23514';
  end if;

  select * into v_pass
  from public.lesson_passes
  where member_id = p_member_id
    and status = 'active'::public.lesson_pass_status
  for update;

  if v_pass.id is null or v_pass.used_count >= v_pass.total_count then
    raise exception '사용 가능한 활성 레슨권이 없습니다.' using errcode = '23514';
  end if;

  v_new_used_count := v_pass.used_count + 1;
  perform set_config('app.audit_reason', '장애 복구 과거 레슨 등록 및 1회 차감', true);

  update public.lesson_passes
  set
    used_count = v_new_used_count,
    status = case
      when v_new_used_count = total_count then 'exhausted'::public.lesson_pass_status
      else status
    end
  where id = v_pass.id;

  insert into public.lesson_records (
    member_id,
    lesson_pass_id,
    actual_coach_id,
    request_method,
    requested_at,
    lesson_date,
    daily_sequence,
    approved_at,
    approved_by,
    status,
    deducted_count,
    note
  )
  values (
    p_member_id,
    v_pass.id,
    p_actual_coach_id,
    'outage_recovery'::public.lesson_request_method,
    now(),
    p_lesson_date,
    v_daily_sequence,
    now(),
    (select auth.uid()),
    'approved'::public.lesson_record_status,
    1,
    nullif(trim(p_note), '')
  )
  returning id into v_record_id;

  if v_new_used_count = v_pass.total_count then
    select id into v_next_pass_id
    from public.lesson_passes
    where member_id = p_member_id
      and status = 'pending'::public.lesson_pass_status
    order by paid_at, created_at, id
    limit 1
    for update;

    if v_next_pass_id is not null then
      perform set_config('app.audit_reason', '기존권 소진 후 대기권 자동 활성화', true);
      update public.lesson_passes
      set status = 'active'::public.lesson_pass_status,
          start_date = coalesce(start_date, public.business_date())
      where id = v_next_pass_id;
    end if;
  end if;

  return v_record_id;
end;
$$;

revoke all on function public.register_past_lesson(uuid, date, uuid, text)
from public, anon, authenticated;
grant execute on function public.register_past_lesson(uuid, date, uuid, text)
to authenticated;

