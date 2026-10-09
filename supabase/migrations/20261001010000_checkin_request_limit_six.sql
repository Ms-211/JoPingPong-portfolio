-- 기존 migration 적용 이력과 데이터를 보존하고 요청 한도만 6회로 낮춘다.
create or replace function public.request_checkin(p_token text)
returns table (
  result_code text,
  member_name text,
  warning_codes text[],
  request_time timestamptz,
  remaining_count integer
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
  v_approved_count integer;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 256 then
    return query select 'invalid_qr', null::text, '{}'::text[], null::timestamptz, null::integer;
    return;
  end if;

  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select * into v_token
  from public.member_qr_tokens
  where token_hash = v_token_hash for update;

  if v_token.id is null then
    return query select 'invalid_qr', null::text, '{}'::text[], null::timestamptz, null::integer;
    return;
  end if;

  if not v_token.is_active then
    return query select 'inactive_qr', null::text, '{}'::text[], null::timestamptz, null::integer;
    return;
  end if;

  -- 유효 토큰별 1분 6회. DB RPC 직접 호출에도 같은 제한을 적용한다.
  if v_token.request_window_started_at is null
    or v_token.request_window_started_at <= now() - interval '1 minute' then
    update public.member_qr_tokens
    set request_window_started_at = now(), request_count = 1
    where id = v_token.id;
  elsif v_token.request_count >= 6 then
    return query select 'rate_limited', null::text, '{}'::text[], null::timestamptz, null::integer;
    return;
  else
    update public.member_qr_tokens
    set request_count = request_count + 1
    where id = v_token.id;
  end if;
  select * into v_member
  from public.members
  where id = v_token.member_id;

  perform pg_advisory_xact_lock(hashtextextended(v_member.id::text, 1));

  select coalesce(sum(total_count - used_count), 0)::integer
  into remaining_count
  from public.lesson_passes
  where member_id = v_member.id
    and status = 'active'::public.lesson_pass_status;

  select * into v_pending
  from public.lesson_records
  where member_id = v_member.id
    and status = 'pending'::public.lesson_record_status
  order by requested_at desc
  limit 1;

  if v_pending.id is not null then
    return query
      select
        'already_pending',
        v_member.name,
        public.checkin_warnings(v_member.id),
        v_pending.requested_at,
        remaining_count;
    return;
  end if;

  select count(*)::integer into v_approved_count
  from public.lesson_records
  where member_id = v_member.id
    and lesson_date = public.business_date()
    and status = 'approved'::public.lesson_record_status;

  if v_approved_count >= 2 then
    return query
      select
        'daily_limit_reached',
        v_member.name,
        public.checkin_warnings(v_member.id),
        null::timestamptz,
        remaining_count;
    return;
  end if;

  perform set_config(
    'app.audit_reason',
    case when v_approved_count = 1 then '두 번째 QR 체크인 요청' else 'QR 체크인 요청' end,
    true
  );

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

  result_code := case when v_approved_count = 1 then 'second_created' else 'created' end;
  member_name := v_member.name;
  warning_codes := public.checkin_warnings(v_member.id);
  return next;
end;
$$;

revoke all on function public.request_checkin(text) from public, anon, authenticated;
grant execute on function public.request_checkin(text) to anon, authenticated;
