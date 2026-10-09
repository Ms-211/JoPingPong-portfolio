begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

insert into public.members (id, name)
values ('97000000-0000-0000-0000-000000000001', '레슨권 수정 테스트 회원');

select lives_ok(
  $$select public.register_lesson_pass(
    '97000000-0000-0000-0000-000000000001', '2026-08-01', 0, '미사용', '기존 메모'
  )$$,
  '첫 레슨권을 등록할 수 있다'
);

select lives_ok(
  $$select public.register_lesson_pass(
    '97000000-0000-0000-0000-000000000001', '2026-08-10', 0, '미사용', null
  )$$,
  '예비 레슨권을 등록할 수 있다'
);

select lives_ok(
  $$select public.admin_edit_lesson_pass(
    (
      select id from public.lesson_passes
      where member_id = '97000000-0000-0000-0000-000000000001'
        and status = 'active'
    ),
    '2026-07-15', 5, '수정된 메모', '초기 등록 정보 정정'
  )$$,
  '관리자가 등록일과 잔여 횟수, 메모를 수정할 수 있다'
);

select is(
  (
    select paid_at::text || ':' || recommended_use_by::text || ':' || used_count::text || ':' || memo
    from public.lesson_passes
    where member_id = '97000000-0000-0000-0000-000000000001'
      and status = 'active'
  ),
  '2026-07-15:2026-09-14:3:수정된 메모',
  '등록일 수정은 권장 소진일을 재계산하고 잔여 5회를 보존한다'
);

select is(
  (
    select adjustment_count::integer
    from public.pass_adjustments
    where lesson_pass_id = (
      select id from public.lesson_passes
      where member_id = '97000000-0000-0000-0000-000000000001'
        and status = 'active'
    )
  ),
  -3,
  '잔여 횟수 변경은 조정 이력으로 남는다'
);

select lives_ok(
  $$select public.admin_edit_lesson_pass(
    (
      select id from public.lesson_passes
      where member_id = '97000000-0000-0000-0000-000000000001'
        and status = 'active'
    ),
    '2026-07-15', 0, '수정된 메모', '잔여 횟수 0회로 정정'
  )$$,
  '활성 레슨권을 0회로 정정할 수 있다'
);

select is(
  (
    select count(*)
    from public.lesson_passes
    where member_id = '97000000-0000-0000-0000-000000000001'
      and status = 'active'
      and paid_at = '2026-08-10'
  ),
  1::bigint,
  '0회로 정정하면 다음 예비 레슨권이 활성화된다'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);

select throws_ok(
  $$select public.admin_edit_lesson_pass(
    (
      select id from public.lesson_passes
      where member_id = '97000000-0000-0000-0000-000000000001'
        and status = 'active'
    ),
    '2026-08-10', 7, null, '코치 수정 시도'
  )$$,
  '42501',
  '관리자만 레슨권을 수정할 수 있습니다.',
  '코치는 레슨권을 수정할 수 없다'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

select throws_ok(
  $$select public.admin_edit_lesson_pass(
    (
      select id from public.lesson_passes
      where member_id = '97000000-0000-0000-0000-000000000001'
        and status = 'exhausted'
    ),
    '2026-07-15', 1, null, '과거권 횟수 변경 시도'
  )$$,
  '22023',
  '사용 중 또는 사용 예정 레슨권만 잔여 횟수를 조정할 수 있습니다.',
  '과거 레슨권의 잔여 횟수는 수정할 수 없다'
);

select * from finish();

rollback;
