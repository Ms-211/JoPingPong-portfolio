begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

insert into public.members (id, name, status)
values
  ('81000000-0000-4000-8000-000000000001', '과거 등록 회원', 'active'),
  ('81000000-0000-4000-8000-000000000002', '레슨권 없는 과거 회원', 'ended');

insert into public.lesson_passes (
  id, member_id, used_count, start_date, paid_at, paid_amount, payment_method, status, created_by
)
values (
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  0,
  public.business_date(),
  public.business_date(),
  200000,
  '현금',
  'active',
  '10000000-0000-0000-0000-000000000001'
);

select lives_ok(
  $$select public.register_past_lesson(
    '81000000-0000-4000-8000-000000000001',
    public.business_date() - 1,
    '10000000-0000-0000-0000-000000000002',
    '인터넷 장애 복구'
  )$$,
  'an admin can register a past lesson'
);

select is(
  (select used_count from public.lesson_passes where id = '82000000-0000-4000-8000-000000000001'),
  1::smallint,
  'past lesson registration deducts exactly one lesson'
);

select is(
  (
    select request_method::text || ':' || status::text || ':' || daily_sequence::text || ':' || deducted_count::text
    from public.lesson_records
    where member_id = '81000000-0000-4000-8000-000000000001'
    order by created_at
    limit 1
  ),
  'outage_recovery:approved:1:1',
  'a recovery record is immediately approved with the first daily slot'
);

select is(
  (
    select actual_coach_id
    from public.lesson_records
    where member_id = '81000000-0000-4000-8000-000000000001'
    order by created_at
    limit 1
  ),
  '10000000-0000-0000-0000-000000000002'::uuid,
  'the selected actual coach is recorded'
);

select is(
  (
    select approved_by
    from public.lesson_records
    where member_id = '81000000-0000-4000-8000-000000000001'
    order by created_at
    limit 1
  ),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'the signed-in admin is recorded as approver'
);

select is(
  (
    select note
    from public.lesson_records
    where member_id = '81000000-0000-4000-8000-000000000001'
    order by created_at
    limit 1
  ),
  '인터넷 장애 복구',
  'the recovery note is retained'
);

select ok(
  exists (
    select 1 from public.audit_logs
    where entity_type in ('lesson_records', 'lesson_passes')
      and reason = '장애 복구 과거 레슨 등록 및 1회 차감'
  ),
  'recovery writes an audit reason'
);

select lives_ok(
  $$select public.register_past_lesson(
    '81000000-0000-4000-8000-000000000001',
    public.business_date() - 1,
    '10000000-0000-0000-0000-000000000002',
    null
  )$$,
  'a second lesson on the same day is allowed'
);

select is(
  (
    select max(daily_sequence)
    from public.lesson_records
    where member_id = '81000000-0000-4000-8000-000000000001'
  ),
  2::smallint,
  'the second lesson uses the second daily slot'
);

select throws_ok(
  $$select public.register_past_lesson(
    '81000000-0000-4000-8000-000000000001',
    public.business_date() - 1,
    '10000000-0000-0000-0000-000000000002',
    null
  )$$,
  '23514',
  '해당 날짜에 이미 2회 레슨이 등록되어 있습니다.',
  'a third lesson on the same date is blocked'
);

select throws_ok(
  $$select public.register_past_lesson(
    '81000000-0000-4000-8000-000000000001',
    public.business_date() + 1,
    '10000000-0000-0000-0000-000000000002',
    null
  )$$,
  '22023',
  '레슨일은 오늘 또는 과거 날짜여야 합니다.',
  'a future lesson date is blocked'
);

select throws_ok(
  $$select public.register_past_lesson(
    '81000000-0000-4000-8000-000000000002',
    public.business_date() - 1,
    '10000000-0000-0000-0000-000000000002',
    null
  )$$,
  '23514',
  '사용 가능한 활성 레슨권이 없습니다.',
  'a recovery without an active pass is blocked'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.register_past_lesson(
    '81000000-0000-4000-8000-000000000001',
    public.business_date(),
    '10000000-0000-0000-0000-000000000002',
    null
  )$$,
  '42501',
  '관리자만 과거 레슨을 등록할 수 있습니다.',
  'a coach cannot register a past lesson'
);

select * from finish();
rollback;

