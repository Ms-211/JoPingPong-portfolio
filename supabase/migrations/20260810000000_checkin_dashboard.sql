create function public.business_date()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;

alter table public.lesson_records
alter column lesson_date set default public.business_date();

create trigger lesson_records_audit_business_change
after insert or update on public.lesson_records
for each row execute function public.audit_business_row_change();

create function public.checkin_warnings(p_member_id uuid)
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
begin
  select * into v_member
  from public.members
  where id = p_member_id;

  select * into v_pass
  from public.lesson_passes
  where member_id = p_member_id
    and status = 'active'::public.lesson_pass_status
  limit 1;

  if v_member.status = 'paused'::public.member_status then
    v_warnings := array_append(v_warnings, 'paused');
  elsif v_member.status = 'ended'::public.member_status then
    v_warnings := array_append(v_warnings, 'ended');
  end if;

  if v_pass.id is null or v_pass.used_count >= v_pass.total_count then
    v_warnings := array_append(v_warnings, 'no_remaining');
  else
    if v_pass.total_count - v_pass.used_count = 1 then
      v_warnings := array_append(v_warnings, 'last_lesson');
    end if;

    if v_pass.recommended_use_by < public.business_date() then
      v_warnings := array_append(v_warnings, 'recommended_date_passed');
    end if;
  end if;

  return v_warnings;
end;
$$;

create function public.request_checkin(p_token text)
returns table (
  result_code text,
  member_name text,
  warning_codes text[],
  request_time timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.member_qr_tokens;
  v_member public.members;
  v_pending public.lesson_records;
  v_token_hash text;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 256 then
    return query select 'invalid_qr', null::text, '{}'::text[], null::timestamptz;
    return;
  end if;

  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select * into v_token
  from public.member_qr_tokens
  where token_hash = v_token_hash;

  if v_token.id is null then
    return query select 'invalid_qr', null::text, '{}'::text[], null::timestamptz;
    return;
  end if;

  if not v_token.is_active then
    return query select 'inactive_qr', null::text, '{}'::text[], null::timestamptz;
    return;
  end if;

  select * into v_member
  from public.members
  where id = v_token.member_id;

  perform pg_advisory_xact_lock(hashtextextended(v_member.id::text, 1));

  select * into v_pending
  from public.lesson_records
  where member_id = v_member.id
    and status = 'pending'::public.lesson_record_status
  limit 1;

  if v_pending.id is not null then
    return query
      select
        'already_pending',
        v_member.name,
        public.checkin_warnings(v_member.id),
        v_pending.requested_at;
    return;
  end if;

  if exists (
    select 1
    from public.lesson_records
    where member_id = v_member.id
      and lesson_date = public.business_date()
      and status = 'approved'::public.lesson_record_status
  ) then
    return query
      select
        'already_approved',
        v_member.name,
        public.checkin_warnings(v_member.id),
        null::timestamptz;
    return;
  end if;

  perform set_config('app.audit_reason', 'QR 체크인 요청', true);

  insert into public.lesson_records (
    member_id,
    request_method,
    lesson_date,
    status
  )
  values (
    v_member.id,
    'qr'::public.lesson_request_method,
    public.business_date(),
    'pending'::public.lesson_record_status
  )
  returning requested_at into request_time;

  result_code := 'created';
  member_name := v_member.name;
  warning_codes := public.checkin_warnings(v_member.id);
  return next;
end;
$$;

create function public.request_manual_checkin(p_member_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_approved_count integer;
begin
  if not (select public.is_active_staff()) then
    raise exception '활성 관리자 또는 코치만 직접 요청을 등록할 수 있습니다.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.members
    where id = p_member_id
      and status <> 'ended'::public.member_status
  ) then
    raise exception '이용 가능한 회원을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_member_id::text, 1));

  if exists (
    select 1 from public.lesson_records
    where member_id = p_member_id
      and status = 'pending'::public.lesson_record_status
  ) then
    return 'already_pending';
  end if;

  select count(*) into v_approved_count
  from public.lesson_records
  where member_id = p_member_id
    and lesson_date = public.business_date()
    and status = 'approved'::public.lesson_record_status;

  if v_approved_count >= 2 then
    return 'daily_limit_reached';
  end if;

  perform set_config('app.audit_reason', '코치 직접 승인 대기 등록', true);

  insert into public.lesson_records (
    member_id,
    request_method,
    lesson_date,
    status,
    note
  )
  values (
    p_member_id,
    'coach_manual'::public.lesson_request_method,
    public.business_date(),
    'pending'::public.lesson_record_status,
    '코치 직접 등록'
  );

  return 'created';
end;
$$;

revoke all on function public.business_date() from public, anon;
revoke all on function public.checkin_warnings(uuid) from public, anon, authenticated;
revoke all on function public.request_checkin(text) from public, anon, authenticated;
revoke all on function public.request_manual_checkin(uuid) from public, anon, authenticated;

grant execute on function public.business_date() to authenticated;
grant execute on function public.request_checkin(text) to anon, authenticated;
grant execute on function public.request_manual_checkin(uuid) to authenticated;
