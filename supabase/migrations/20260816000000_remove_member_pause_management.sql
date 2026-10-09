-- 휴회 운영을 제거한다. 기존 휴회 회원은 이용 중으로 복귀시키며 레슨권과 출석 기록은 유지한다.
update public.members
set status = 'active'::public.member_status
where status = 'paused'::public.member_status;

alter table public.members
  drop column if exists pause_start_date,
  drop column if exists pause_end_date;

alter table public.members
  add constraint members_status_without_pause check (status <> 'paused'::public.member_status);

create or replace function public.checkin_warnings(p_member_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_pass public.lesson_passes;
  v_warnings text[] := '{}'::text[];
  v_remaining integer;
begin
  select * into v_member from public.members where id = p_member_id;

  select * into v_pass
  from public.lesson_passes
  where member_id = p_member_id
    and status = 'active'::public.lesson_pass_status
  limit 1;

  if v_member.status = 'ended'::public.member_status then
    v_warnings := array_append(v_warnings, 'ended');
  end if;

  if v_pass.id is null or v_pass.used_count >= v_pass.total_count then
    v_warnings := array_append(v_warnings, 'no_remaining');
  else
    v_remaining := v_pass.total_count - v_pass.used_count;
    if v_remaining <= 2 then
      v_warnings := array_append(v_warnings, 'low_remaining');
    end if;
    if v_pass.recommended_use_by < public.business_date() then
      v_warnings := array_append(v_warnings, 'recommended_date_passed');
    end if;
  end if;

  return v_warnings;
end;
$$;

create or replace function public.approve_lesson_record(p_lesson_record_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.lesson_records;
  v_member public.members;
  v_pass public.lesson_passes;
  v_next_pass_id uuid;
  v_daily_sequence smallint;
  v_new_used_count smallint;
begin
  if not (select public.is_active_staff()) then
    raise exception '활성 관리자 또는 코치만 승인할 수 있습니다.' using errcode = '42501';
  end if;

  select * into v_record from public.lesson_records where id = p_lesson_record_id;
  if not found then return 'not_found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_record.member_id::text, 1));
  select * into v_record from public.lesson_records where id = p_lesson_record_id for update;
  if v_record.status <> 'pending'::public.lesson_record_status then
    return 'already_' || v_record.status::text;
  end if;

  select * into v_member from public.members where id = v_record.member_id for update;
  if v_member.status = 'ended'::public.member_status then return 'member_ended'; end if;

  select candidate::smallint into v_daily_sequence
  from generate_series(1, 2) as candidate
  where not exists (
    select 1 from public.lesson_records approved
    where approved.member_id = v_record.member_id
      and approved.lesson_date = v_record.lesson_date
      and approved.status = 'approved'::public.lesson_record_status
      and approved.daily_sequence = candidate
  )
  order by candidate limit 1;
  if v_daily_sequence is null then return 'daily_limit_reached'; end if;

  select * into v_pass
  from public.lesson_passes
  where member_id = v_record.member_id and status = 'active'::public.lesson_pass_status
  for update;
  if v_pass.id is null or v_pass.used_count >= v_pass.total_count then
    return 'no_available_pass';
  end if;

  v_new_used_count := v_pass.used_count + 1;
  perform set_config('app.audit_reason', '레슨 승인 및 1회 차감', true);
  update public.lesson_passes
  set used_count = v_new_used_count,
      status = case when v_new_used_count = total_count then 'exhausted'::public.lesson_pass_status else status end
  where id = v_pass.id;

  update public.lesson_records
  set lesson_pass_id = v_pass.id,
      actual_coach_id = (select auth.uid()),
      approved_at = now(),
      approved_by = (select auth.uid()),
      status = 'approved'::public.lesson_record_status,
      daily_sequence = v_daily_sequence,
      deducted_count = 1
  where id = v_record.id;

  if v_new_used_count = v_pass.total_count then
    select id into v_next_pass_id
    from public.lesson_passes
    where member_id = v_record.member_id and status = 'pending'::public.lesson_pass_status
    order by paid_at, created_at, id limit 1 for update;

    if v_next_pass_id is not null then
      perform set_config('app.audit_reason', '기존권 소진 후 대기권 자동 활성화', true);
      update public.lesson_passes
      set status = 'active'::public.lesson_pass_status,
          start_date = coalesce(start_date, public.business_date())
      where id = v_next_pass_id;
    end if;
  end if;

  return 'approved';
end;
$$;
