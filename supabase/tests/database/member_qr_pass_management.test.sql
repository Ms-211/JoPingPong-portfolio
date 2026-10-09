begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

insert into public.members (id, name)
values
  ('92000000-0000-0000-0000-000000000001', '레슨권 테스트 회원'),
  ('92000000-0000-0000-0000-000000000002', '기한 경과 테스트 회원'),
  ('92000000-0000-0000-0000-000000000003', '소진 상태 정리 테스트 회원');

insert into public.lesson_passes (
  member_id, total_count, used_count, start_date, paid_at,
  paid_amount, payment_method, status, created_by
) values (
  '92000000-0000-0000-0000-000000000003', 8, 8, '2026-06-01', '2026-06-01',
  0, '미사용', 'active', '10000000-0000-0000-0000-000000000001'
);

select lives_ok(
  $$select public.register_lesson_pass(
    '92000000-0000-0000-0000-000000000003', current_date, 0, '미사용', null
  )$$,
  'registration repairs a fully used active pass'
);

select is(
  (select count(*) from public.lesson_passes where member_id = '92000000-0000-0000-0000-000000000003' and status = 'exhausted'),
  1::bigint,
  'the fully used legacy active pass becomes exhausted'
);

select is(
  (select count(*) from public.lesson_passes where member_id = '92000000-0000-0000-0000-000000000003' and status = 'active' and used_count = 0),
  1::bigint,
  'the newly registered pass becomes active immediately'
);

select lives_ok(
  $$select public.register_lesson_pass(
    '92000000-0000-0000-0000-000000000001',
    '2026-08-08',
    200000,
    '계좌이체',
    null
  )$$,
  'the first payment can be registered'
);

select is(
  (select status::text from public.lesson_passes where member_id = '92000000-0000-0000-0000-000000000001'),
  'active',
  'the first pass becomes active'
);

select is(
  (select recommended_use_by from public.lesson_passes where member_id = '92000000-0000-0000-0000-000000000001'),
  '2026-10-07'::date,
  'recommended use-by is payment date plus two months minus one day'
);

select lives_ok(
  $$select public.register_lesson_pass(
    '92000000-0000-0000-0000-000000000001',
    '2026-08-20',
    200000,
    '카드',
    '추가 결제'
  )$$,
  'an additional payment can be registered'
);

select is(
  (select count(*) from public.lesson_passes where member_id = '92000000-0000-0000-0000-000000000001' and status = 'pending'),
  1::bigint,
  'the additional pass waits while an active pass exists'
);

select lives_ok(
  $$select public.register_lesson_pass(
    '92000000-0000-0000-0000-000000000002',
    '2020-01-01',
    100000,
    '현금',
    null
  )$$,
  'a pass with an old payment date can be registered'
);

select is(
  (select status::text from public.lesson_passes where member_id = '92000000-0000-0000-0000-000000000002'),
  'active',
  'passing the recommended date never expires a pass automatically'
);

select lives_ok(
  $$select public.manually_expire_lesson_pass(
    (
      select id from public.lesson_passes
      where member_id = '92000000-0000-0000-0000-000000000001'
        and status = 'active'
    ),
    '회원 안내 후 수동 처리'
  )$$,
  'an admin can manually expire an active pass with a reason'
);

select is(
  (
    select status::text || ':' || used_count::text
    from public.lesson_passes
    where member_id = '92000000-0000-0000-0000-000000000001'
      and status = 'expired'
  ),
  'expired:0',
  'manual expiry preserves the historical remaining count'
);

select is(
  (select count(*) from public.lesson_passes where member_id = '92000000-0000-0000-0000-000000000001' and status = 'active'),
  1::bigint,
  'the oldest waiting pass activates after manual expiry'
);

select ok(
  (select count(*) >= 6 from public.audit_logs where entity_type in ('members', 'lesson_passes')),
  'member and lesson pass changes create audit logs'
);

select lives_ok(
  $$select public.issue_member_qr(
    '92000000-0000-0000-0000-000000000001',
    repeat('a', 64),
    'members/test/qr/first.svg',
    null
  )$$,
  'an initial member QR can be issued'
);

select is(
  (select count(*) from public.member_qr_tokens where member_id = '92000000-0000-0000-0000-000000000001' and is_active),
  1::bigint,
  'a member has one active QR'
);

select throws_ok(
  $$select public.issue_member_qr(
    '92000000-0000-0000-0000-000000000001',
    repeat('b', 64),
    'members/test/qr/second.svg',
    null
  )$$,
  '22023',
  'QR 재발급 사유가 필요합니다.',
  'QR reissue requires a reason'
);

select lives_ok(
  $$select public.issue_member_qr(
    '92000000-0000-0000-0000-000000000001',
    repeat('b', 64),
    'members/test/qr/second.svg',
    '분실 재발급'
  )$$,
  'a QR can be reissued with a reason'
);

select is(
  (
    select count(*)::text || ':' || count(*) filter (where is_active)::text
    from public.member_qr_tokens
    where member_id = '92000000-0000-0000-0000-000000000001'
  ),
  '2:1',
  'reissue preserves the old QR while only the new QR remains active'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);

select throws_ok(
  $$select public.register_lesson_pass(
    '92000000-0000-0000-0000-000000000001',
    current_date,
    100000,
    '현금',
    null
  )$$,
  '42501',
  '관리자만 레슨권을 등록할 수 있습니다.',
  'a coach cannot register a payment'
);

select * from finish();

rollback;
