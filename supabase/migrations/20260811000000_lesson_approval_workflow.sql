create function public.approve_lesson_record(p_lesson_record_id uuid)
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

  select * into v_record
  from public.lesson_records
  where id = p_lesson_record_id;

  if not found then
    return 'not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_record.member_id::text, 1));

  select * into v_record
  from public.lesson_records
  where id = p_lesson_record_id
  for update;

  if v_record.status <> 'pending'::public.lesson_record_status then
    return 'already_' || v_record.status::text;
  end if;

  select * into v_member
  from public.members
  where id = v_record.member_id
  for update;

  if v_member.status = 'paused'::public.member_status then
    return 'member_paused';
  end if;

  if v_member.status = 'ended'::public.member_status then
    return 'member_ended';
  end if;

  select candidate::smallint into v_daily_sequence
  from generate_series(1, 2) as candidate
  where not exists (
    select 1
    from public.lesson_records approved
    where approved.member_id = v_record.member_id
      and approved.lesson_date = v_record.lesson_date
      and approved.status = 'approved'::public.lesson_record_status
      and approved.daily_sequence = candidate
  )
  order by candidate
  limit 1;

  if v_daily_sequence is null then
    return 'daily_limit_reached';
  end if;

  select * into v_pass
  from public.lesson_passes
  where member_id = v_record.member_id
    and status = 'active'::public.lesson_pass_status
  for update;

  if v_pass.id is null or v_pass.used_count >= v_pass.total_count then
    return 'no_available_pass';
  end if;

  v_new_used_count := v_pass.used_count + 1;
  perform set_config('app.audit_reason', '레슨 승인 및 1회 차감', true);

  update public.lesson_passes
  set
    used_count = v_new_used_count,
    status = case
      when v_new_used_count = total_count then 'exhausted'::public.lesson_pass_status
      else status
    end
  where id = v_pass.id;

  update public.lesson_records
  set
    lesson_pass_id = v_pass.id,
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
    where member_id = v_record.member_id
      and status = 'pending'::public.lesson_pass_status
    order by paid_at, created_at, id
    limit 1
    for update;

    if v_next_pass_id is not null then
      perform set_config('app.audit_reason', '기존권 소진 후 대기권 자동 활성화', true);

      update public.lesson_passes
      set
        status = 'active'::public.lesson_pass_status,
        start_date = coalesce(start_date, public.business_date())
      where id = v_next_pass_id;
    end if;
  end if;

  return 'approved';
end;
$$;

create function public.approve_lesson_records(p_lesson_record_ids uuid[])
returns table (record_id uuid, result_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record_id uuid;
begin
  if not (select public.is_active_staff()) then
    raise exception '활성 관리자 또는 코치만 승인할 수 있습니다.' using errcode = '42501';
  end if;

  foreach v_record_id in array coalesce(p_lesson_record_ids, '{}'::uuid[])
  loop
    record_id := v_record_id;
    begin
      result_code := public.approve_lesson_record(v_record_id);
    exception when others then
      result_code := 'error';
    end;
    return next;
  end loop;
end;
$$;

create function public.reject_lesson_record(
  p_lesson_record_id uuid,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.lesson_records;
begin
  if not (select public.is_active_staff()) then
    raise exception '활성 관리자 또는 코치만 거절할 수 있습니다.' using errcode = '42501';
  end if;

  select * into v_record
  from public.lesson_records
  where id = p_lesson_record_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if v_record.status <> 'pending'::public.lesson_record_status then
    return 'already_' || v_record.status::text;
  end if;

  perform set_config(
    'app.audit_reason',
    coalesce(nullif(trim(p_reason), ''), '레슨 요청 거절'),
    true
  );

  update public.lesson_records
  set
    status = 'rejected'::public.lesson_record_status,
    rejected_at = now(),
    rejected_by = (select auth.uid()),
    rejection_reason = nullif(trim(p_reason), '')
  where id = v_record.id;

  return 'rejected';
end;
$$;

create function public.reject_lesson_records(
  p_lesson_record_ids uuid[],
  p_reason text default null
)
returns table (record_id uuid, result_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record_id uuid;
begin
  if not (select public.is_active_staff()) then
    raise exception '활성 관리자 또는 코치만 거절할 수 있습니다.' using errcode = '42501';
  end if;

  foreach v_record_id in array coalesce(p_lesson_record_ids, '{}'::uuid[])
  loop
    record_id := v_record_id;
    begin
      result_code := public.reject_lesson_record(v_record_id, p_reason);
    exception when others then
      result_code := 'error';
    end;
    return next;
  end loop;
end;
$$;

create function public.cancel_lesson_approval(
  p_lesson_record_id uuid,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.lesson_records;
  v_pass public.lesson_passes;
  v_current_active public.lesson_passes;
  v_restored_status public.lesson_pass_status;
begin
  if not (select public.is_admin()) then
    raise exception '관리자만 승인을 취소할 수 있습니다.' using errcode = '42501';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception '승인 취소 사유가 필요합니다.' using errcode = '22023';
  end if;

  select * into v_record
  from public.lesson_records
  where id = p_lesson_record_id;

  if not found then
    return 'not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_record.member_id::text, 1));

  select * into v_record
  from public.lesson_records
  where id = p_lesson_record_id
  for update;

  if v_record.status <> 'approved'::public.lesson_record_status then
    return 'already_' || v_record.status::text;
  end if;

  select * into v_pass
  from public.lesson_passes
  where id = v_record.lesson_pass_id
  for update;

  if v_pass.id is null or v_pass.used_count < 1 or v_record.deducted_count <> 1 then
    return 'restore_failed';
  end if;

  v_restored_status := v_pass.status;

  if v_pass.status = 'exhausted'::public.lesson_pass_status then
    select * into v_current_active
    from public.lesson_passes
    where member_id = v_record.member_id
      and status = 'active'::public.lesson_pass_status
      and id <> v_pass.id
    for update;

    if v_current_active.id is null then
      v_restored_status := 'active'::public.lesson_pass_status;
    elsif v_current_active.used_count = 0 then
      perform set_config('app.audit_reason', '이전 승인 취소로 신규권 활성화 복원', true);

      update public.lesson_passes
      set
        status = 'pending'::public.lesson_pass_status,
        start_date = null
      where id = v_current_active.id;

      v_restored_status := 'active'::public.lesson_pass_status;
    else
      v_restored_status := 'pending'::public.lesson_pass_status;
    end if;
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);

  update public.lesson_passes
  set
    used_count = used_count - 1,
    status = v_restored_status
  where id = v_pass.id;

  update public.lesson_records
  set
    status = 'cancelled'::public.lesson_record_status,
    deducted_count = 0,
    cancelled_at = now(),
    cancelled_by = (select auth.uid()),
    cancellation_reason = trim(p_reason)
  where id = v_record.id;

  return 'cancelled';
end;
$$;

revoke all on function public.approve_lesson_record(uuid) from public, anon, authenticated;
revoke all on function public.approve_lesson_records(uuid[]) from public, anon, authenticated;
revoke all on function public.reject_lesson_record(uuid, text) from public, anon, authenticated;
revoke all on function public.reject_lesson_records(uuid[], text) from public, anon, authenticated;
revoke all on function public.cancel_lesson_approval(uuid, text) from public, anon, authenticated;

grant execute on function public.approve_lesson_record(uuid) to authenticated;
grant execute on function public.approve_lesson_records(uuid[]) to authenticated;
grant execute on function public.reject_lesson_record(uuid, text) to authenticated;
grant execute on function public.reject_lesson_records(uuid[], text) to authenticated;
grant execute on function public.cancel_lesson_approval(uuid, text) to authenticated;

