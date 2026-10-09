begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
insert into public.members(id, name) values ('96000000-0000-4000-8000-000000000001', '보안 테스트 회원');
select public.issue_member_qr(
  '96000000-0000-4000-8000-000000000001',
  encode(extensions.digest(repeat('s', 43), 'sha256'), 'hex'),
  'security-test.svg'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is((select result_code from public.request_checkin(repeat('s', 43))), 'created', '익명 QR의 첫 요청을 허용한다');
select ok(
  (select bool_and(result_code = 'already_pending') from generate_series(1, 5) n
   cross join lateral public.request_checkin(repeat('s', 43 + n * 0))),
  '같은 분의 나머지 5회는 기존 대기 요청을 반환한다'
);
select is((select result_code from public.request_checkin(repeat('s', 43))), 'rate_limited', '직접 익명 RPC 호출도 7회부터 제한한다');
select ok(
  (select member_name is null and remaining_count is null and request_time is null and warning_codes = '{}'::text[]
   from public.request_checkin(repeat('s', 43))),
  '제한 응답에 회원정보를 포함하지 않는다'
);

reset role;
select is((select request_count::integer from public.member_qr_tokens where member_id = '96000000-0000-4000-8000-000000000001'), 6, '제한 이후 카운터를 증가시키지 않는다');
update public.member_qr_tokens set request_window_started_at = now() - interval '61 seconds'
where member_id = '96000000-0000-4000-8000-000000000001';
set local role anon;
select is((select result_code from public.request_checkin(repeat('s', 43))), 'already_pending', '창이 지나면 다시 요청할 수 있다');
reset role;
update public.member_qr_tokens set is_active = false, revoked_at = now(), revoked_reason = '테스트 폐기'
where member_id = '96000000-0000-4000-8000-000000000001';
set local role anon;
select is((select result_code from public.request_checkin(repeat('s', 43))), 'inactive_qr', '폐기된 QR은 계속 차단된다');

reset role;
select * from finish();
rollback;
