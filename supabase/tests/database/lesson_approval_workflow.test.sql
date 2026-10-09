begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

insert into public.members (id, name, status)
values
  ('71000000-0000-4000-8000-000000000001', '정상 승인 회원', 'active'),
  ('71000000-0000-4000-8000-000000000002', '이용 종료 회원', 'ended'),
  ('71000000-0000-4000-8000-000000000003', '레슨권 없음 회원', 'active'),
  ('71000000-0000-4000-8000-000000000004', '마지막 횟수 회원', 'active'),
  ('71000000-0000-4000-8000-000000000005', '거절 회원', 'active'),
  ('71000000-0000-4000-8000-000000000006', '하루 두 번 회원', 'active');

insert into public.lesson_passes (
  id,
  member_id,
  used_count,
  start_date,
  paid_at,
  paid_amount,
  payment_method,
  status,
  created_by
)
values
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 0, public.business_date(), public.business_date(), 200000, '현금', 'active', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 0, public.business_date(), public.business_date(), 200000, '현금', 'active', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000004', 7, public.business_date(), '2026-01-01', 200000, '현금', 'active', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-4000-8000-000000000005', '71000000-0000-4000-8000-000000000004', 0, null, '2026-02-01', 200000, '카드', 'pending', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-4000-8000-000000000006', '71000000-0000-4000-8000-000000000006', 1, public.business_date(), public.business_date(), 200000, '계좌이체', 'active', '10000000-0000-0000-0000-000000000001');

insert into public.lesson_records (
  id,
  member_id,
  request_method,
  lesson_date,
  status
)
values
  ('73000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'qr', public.business_date(), 'pending'),
  ('73000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'qr', public.business_date(), 'pending'),
  ('73000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000003', 'qr', public.business_date(), 'pending'),
  ('73000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000004', 'qr', public.business_date(), 'pending'),
  ('73000000-0000-4000-8000-000000000005', '71000000-0000-4000-8000-000000000005', 'qr', public.business_date(), 'pending'),
  ('73000000-0000-4000-8000-000000000007', '71000000-0000-4000-8000-000000000006', 'coach_manual', public.business_date(), 'pending');

insert into public.lesson_records (
  id,
  member_id,
  lesson_pass_id,
  actual_coach_id,
  request_method,
  lesson_date,
  daily_sequence,
  approved_at,
  approved_by,
  status,
  deducted_count
)
values (
  '73000000-0000-4000-8000-000000000006',
  '71000000-0000-4000-8000-000000000006',
  '72000000-0000-4000-8000-000000000006',
  '10000000-0000-0000-0000-000000000002',
  'coach_manual',
  public.business_date(),
  1,
  now(),
  '10000000-0000-0000-0000-000000000001',
  'approved',
  1
);

select is(
  public.approve_lesson_record('73000000-0000-4000-8000-000000000001'),
  'approved',
  'staff can approve a pending lesson'
);

select is(
  (select used_count from public.lesson_passes where id = '72000000-0000-4000-8000-000000000001'),
  1::smallint,
  'approval deducts exactly one lesson'
);

select is(
  (
    select status::text || ':' || daily_sequence::text || ':' || deducted_count::text || ':' || (actual_coach_id is not null)::text
    from public.lesson_records where id = '73000000-0000-4000-8000-000000000001'
  ),
  'approved:1:1:true',
  'approval records its slot, deduction and actual coach'
);

select is(
  public.approve_lesson_record('73000000-0000-4000-8000-000000000001'),
  'already_approved',
  'repeated approval returns the current state'
);

select is(
  (select used_count from public.lesson_passes where id = '72000000-0000-4000-8000-000000000001'),
  1::smallint,
  'repeated approval never deducts twice'
);

select is(
  public.approve_lesson_record('73000000-0000-4000-8000-000000000002'),
  'member_ended',
  'an ended member cannot be approved'
);

select is(
  (select used_count from public.lesson_passes where id = '72000000-0000-4000-8000-000000000002'),
  0::smallint,
  'a blocked ended-member approval does not deduct'
);

select is(
  public.approve_lesson_record('73000000-0000-4000-8000-000000000003'),
  'no_available_pass',
  'a member without an active pass cannot be approved'
);

select is(
  public.approve_lesson_record('73000000-0000-4000-8000-000000000004'),
  'approved',
  'the last remaining lesson can be approved'
);

select is(
  (
    select status::text || ':' || used_count::text
    from public.lesson_passes where id = '72000000-0000-4000-8000-000000000004'
  ),
  'exhausted:8',
  'the old pass becomes exhausted after its last lesson'
);

select is(
  (
    select status::text || ':' || used_count::text
    from public.lesson_passes where id = '72000000-0000-4000-8000-000000000005'
  ),
  'active:0',
  'the oldest waiting pass activates after exhaustion'
);

select is(
  public.cancel_lesson_approval('73000000-0000-4000-8000-000000000004', '잘못 승인'),
  'cancelled',
  'an admin can cancel an approval'
);

select is(
  (
    select status::text || ':' || used_count::text
    from public.lesson_passes where id = '72000000-0000-4000-8000-000000000004'
  ),
  'active:7',
  'cancellation restores the exact old pass and its count'
);

select is(
  (
    select status::text || ':' || used_count::text || ':' || (start_date is null)::text
    from public.lesson_passes where id = '72000000-0000-4000-8000-000000000005'
  ),
  'pending:0:true',
  'an unused newly activated pass returns to waiting'
);

select is(
  (
    select status::text || ':' || deducted_count::text
    from public.lesson_records where id = '73000000-0000-4000-8000-000000000004'
  ),
  'cancelled:0',
  'the cancelled record remains as history without a deduction'
);

select is(
  public.cancel_lesson_approval('73000000-0000-4000-8000-000000000004', '중복 취소'),
  'already_cancelled',
  'the same approval cannot be cancelled twice'
);

select throws_ok(
  $$select public.cancel_lesson_approval('73000000-0000-4000-8000-000000000001', '')$$,
  '22023',
  '승인 취소 사유가 필요합니다.',
  'cancellation requires a reason'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);

select throws_ok(
  $$select public.cancel_lesson_approval('73000000-0000-4000-8000-000000000001', '코치 취소')$$,
  '42501',
  '관리자만 승인을 취소할 수 있습니다.',
  'a coach cannot cancel an approval'
);

select is(
  public.reject_lesson_record('73000000-0000-4000-8000-000000000005', '방문 취소'),
  'rejected',
  'a coach can reject a pending request'
);

select is(
  (
    select status::text || ':' || (rejected_by is not null)::text || ':' || rejection_reason
    from public.lesson_records where id = '73000000-0000-4000-8000-000000000005'
  ),
  'rejected:true:방문 취소',
  'rejection records its actor and optional reason'
);

select is(
  public.reject_lesson_record('73000000-0000-4000-8000-000000000005', null),
  'already_rejected',
  'a rejected request cannot be rejected twice'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

select is(
  public.approve_lesson_record('73000000-0000-4000-8000-000000000007'),
  'approved',
  'a manually checked second lesson can be approved'
);

select is(
  (select daily_sequence from public.lesson_records where id = '73000000-0000-4000-8000-000000000007'),
  2::smallint,
  'the second same-day approval uses slot two'
);

insert into public.lesson_records (
  id,
  member_id,
  request_method,
  lesson_date,
  status
)
values (
  '73000000-0000-4000-8000-000000000008',
  '71000000-0000-4000-8000-000000000006',
  'coach_manual',
  public.business_date(),
  'pending'
);

select is(
  public.approve_lesson_record('73000000-0000-4000-8000-000000000008'),
  'daily_limit_reached',
  'a third same-day approval is blocked'
);

select is(
  (
    select string_agg(result_code, ',' order by record_id)
    from public.approve_lesson_records(array[
      '73000000-0000-4000-8000-000000000002'::uuid,
      '73000000-0000-4000-8000-000000000003'::uuid
    ])
  ),
  'member_ended,no_available_pass',
  'batch approval returns a result for every selected record'
);

select is(
  (
    select string_agg(result_code, ',' order by record_id)
    from public.reject_lesson_records(
      array[
        '73000000-0000-4000-8000-000000000002'::uuid,
        '73000000-0000-4000-8000-000000000003'::uuid
      ],
      '일괄 거절 테스트'
    )
  ),
  'rejected,rejected',
  'batch rejection returns a result for every selected record'
);

select is(
  (
    select count(*) from public.lesson_records
    where id in (
      '73000000-0000-4000-8000-000000000002',
      '73000000-0000-4000-8000-000000000003'
    ) and status = 'rejected'
  ),
  2::bigint,
  'batch rejection preserves every rejected record'
);

select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select public.approve_lesson_record('73000000-0000-4000-8000-000000000008')$$,
  '42501',
  '활성 관리자 또는 코치만 승인할 수 있습니다.',
  'anonymous callers cannot approve lessons'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

select ok(
  (
    select count(*) >= 12 from public.audit_logs
    where entity_type in ('lesson_records', 'lesson_passes')
      and actor_id is not null
  ),
  'approval, rejection and cancellation changes are audited'
);

select is(
  public.cancel_lesson_approval('73000000-0000-4000-8000-000000000001', '정상 승인 취소'),
  'cancelled',
  'a normal non-exhausting approval can be cancelled'
);

select is(
  (
    select status::text || ':' || used_count::text
    from public.lesson_passes where id = '72000000-0000-4000-8000-000000000001'
  ),
  'active:0',
  'normal cancellation restores the active pass count'
);

select * from finish();

rollback;
