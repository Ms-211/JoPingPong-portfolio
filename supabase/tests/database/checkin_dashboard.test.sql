begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

insert into public.members (
  id,
  name,
  status,
  fixed_weekdays,
  important_memo
)
values
  (
    '93000000-0000-0000-0000-000000000001',
    'QR 테스트 회원',
    'active',
    array[1, 3]::smallint[],
    '주의 메모'
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    '직접 등록 회원',
    'active',
    '{}'::smallint[],
    null
  );

insert into public.member_qr_tokens (
  member_id,
  token_hash,
  is_active,
  revoked_at,
  revoked_reason,
  issued_by
)
values
  (
    '93000000-0000-0000-0000-000000000001',
    encode(extensions.digest(repeat('x', 32), 'sha256'), 'hex'),
    true,
    null,
    null,
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    encode(extensions.digest(repeat('y', 32), 'sha256'), 'hex'),
    false,
    now(),
    '테스트 중지',
    '10000000-0000-0000-0000-000000000001'
  );

insert into public.lesson_passes (
  id,
  member_id,
  total_count,
  used_count,
  start_date,
  paid_at,
  paid_amount,
  payment_method,
  status,
  created_by
)
values (
  '94000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  8,
  7,
  '2020-01-01',
  '2020-01-01',
  100000,
  '현금',
  'active',
  '10000000-0000-0000-0000-000000000001'
);

update public.lesson_passes
set used_count = 5
where id = '94000000-0000-0000-0000-000000000001';

select ok(
  not (public.checkin_warnings('93000000-0000-0000-0000-000000000001') @> array['low_remaining']::text[]),
  'three remaining lessons do not trigger the low remaining warning'
);

update public.lesson_passes
set used_count = 6
where id = '94000000-0000-0000-0000-000000000001';

select ok(
  public.checkin_warnings('93000000-0000-0000-0000-000000000001') @> array['low_remaining']::text[],
  'two remaining lessons trigger the low remaining warning'
);

insert into public.lesson_passes (
  id, member_id, total_count, used_count, paid_at, paid_amount, payment_method, status, created_by
) values (
  '94000000-0000-0000-0000-000000000002',
  '93000000-0000-0000-0000-000000000001',
  8, 0, public.business_date(), 0, '미사용', 'pending',
  '10000000-0000-0000-0000-000000000001'
);

select ok(
  not (public.checkin_warnings('93000000-0000-0000-0000-000000000001') && array['low_remaining', 'no_remaining']::text[]),
  'a waiting pass suppresses low remaining and registration-needed warnings'
);

delete from public.lesson_passes where id = '94000000-0000-0000-0000-000000000002';

update public.lesson_passes
set used_count = 7
where id = '94000000-0000-0000-0000-000000000001';

select is(
  public.business_date(),
  (now() at time zone 'Asia/Seoul')::date,
  'the business date follows Korea time'
);

select is(
  (select result_code from public.request_checkin('short-token')),
  'invalid_qr',
  'a malformed token is rejected without member information'
);

select is(
  (select result_code from public.request_checkin(repeat('y', 32))),
  'inactive_qr',
  'a revoked QR is rejected'
);

select is(
  (select result_code from public.request_checkin(repeat('x', 32))),
  'created',
  'an active QR creates a pending request'
);

select is(
  (select member_name from public.request_checkin(repeat('x', 32))),
  'QR 테스트 회원',
  'a valid QR response includes only the member display name'
);

select is(
  (select remaining_count from public.request_checkin(repeat('x', 32))),
  1,
  'a valid QR response includes the current active pass remaining count'
);

select ok(
  (
    select warning_codes @> array['low_remaining', 'recommended_date_passed']::text[]
    from public.request_checkin(repeat('x', 32))
  ),
  'check-in returns remaining-count and recommended-date warnings'
);

select is(
  (
    select request_method::text
    from public.lesson_records
    where member_id = '93000000-0000-0000-0000-000000000001'
      and status = 'pending'
  ),
  'qr',
  'the request records the QR method'
);

select is(
  (select result_code from public.request_checkin(repeat('x', 32))),
  'already_pending',
  'a duplicate QR request reuses the existing pending state'
);

select is(
  (
    select count(*)
    from public.lesson_records
    where member_id = '93000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'duplicate scans do not create another record'
);

update public.lesson_records
set
  lesson_pass_id = '94000000-0000-0000-0000-000000000001',
  actual_coach_id = '10000000-0000-0000-0000-000000000002',
  approved_at = now(),
  approved_by = '10000000-0000-0000-0000-000000000001',
  status = 'approved',
  daily_sequence = 1,
  deducted_count = 1
where member_id = '93000000-0000-0000-0000-000000000001';

-- 다음 레슨 업무 규칙은 별도 요청 시간 구간에서 검증한다.
update public.member_qr_tokens
set request_window_started_at = now() - interval '61 seconds'
where member_id = '93000000-0000-0000-0000-000000000001';

select is(
  (select result_code from public.request_checkin(repeat('x', 32))),
  'second_created',
  'a QR creates a warned second request after the first same-day approval'
);

select is(
  (
    select request_method::text
    from public.lesson_records
    where member_id = '93000000-0000-0000-0000-000000000001'
      and status = 'pending'
  ),
  'qr',
  'the second lesson request can also come from QR'
);

select is(
  (select result_code from public.request_checkin(repeat('x', 32))),
  'already_pending',
  'scanning again while the second request is pending does not create a third request'
);

delete from public.lesson_records
where member_id = '93000000-0000-0000-0000-000000000001'
  and status = 'pending';

select is(
  public.request_manual_checkin('93000000-0000-0000-0000-000000000001'),
  'created',
  'staff can register a checked second-lesson request manually'
);

select is(
  (
    select request_method::text
    from public.lesson_records
    where member_id = '93000000-0000-0000-0000-000000000001'
      and status = 'pending'
  ),
  'coach_manual',
  'manual registration records its source'
);

select is(
  public.request_manual_checkin('93000000-0000-0000-0000-000000000001'),
  'already_pending',
  'manual registration also prevents duplicate pending requests'
);

select ok(
  (
    select count(*) >= 2
    from public.audit_logs
    where entity_type = 'lesson_records'
      and entity_id in (
        select id from public.lesson_records
        where member_id = '93000000-0000-0000-0000-000000000001'
      )
  ),
  'check-in changes create audit logs without storing raw tokens'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);

select is(
  public.request_manual_checkin('93000000-0000-0000-0000-000000000002'),
  'created',
  'an active coach can register a manual request'
);

select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select public.request_manual_checkin('93000000-0000-0000-0000-000000000002')$$,
  '42501',
  '활성 관리자 또는 코치만 직접 요청을 등록할 수 있습니다.',
  'anonymous callers cannot create manual requests'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

delete from public.lesson_records
where member_id = '93000000-0000-0000-0000-000000000001'
  and status = 'pending';

insert into public.lesson_records (
  member_id,
  lesson_pass_id,
  actual_coach_id,
  request_method,
  lesson_date,
  approved_at,
  approved_by,
  status,
  daily_sequence,
  deducted_count
)
values (
  '93000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'coach_manual',
  public.business_date(),
  now(),
  '10000000-0000-0000-0000-000000000001',
  'approved',
  2,
  1
);

select is(
  public.request_manual_checkin('93000000-0000-0000-0000-000000000001'),
  'daily_limit_reached',
  'manual requests stop after two approved lessons in one day'
);

select is(
  (select result_code from public.request_checkin(repeat('x', 32))),
  'daily_limit_reached',
  'a third QR request is blocked after two approved lessons in one day'
);

select is(
  (
    select count(*)
    from public.lesson_records
    where member_id = '93000000-0000-0000-0000-000000000001'
      and lesson_date = public.business_date()
      and status = 'approved'
  ),
  2::bigint,
  'blocking the third QR request does not create another lesson record'
);

select * from finish();

rollback;
