-- Synthetic portfolio fixtures: numbered names, no phone numbers, placeholder birth dates.
-- Local development identities only. Do not reuse these credentials in production.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'admin@example.com',
    extensions.crypt('LocalDemoOnly123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"개발 관리자"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'coach@example.com',
    extensions.crypt('LocalDemoOnly123!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"개발 코치"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  id,
  email,
  id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  now(),
  now(),
  now()
from auth.users
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002'
)
on conflict (provider_id, provider) do nothing;

update public.profiles
set role = 'admin', display_name = '개발 관리자'
where id = '10000000-0000-0000-0000-000000000001';

update public.profiles
set role = 'coach', display_name = '개발 코치'
where id = '10000000-0000-0000-0000-000000000002';

-- 화면 및 운영 흐름 검증용 더미 담당자 8명 (기본 관리자/코치와 합계 10명)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000',
  ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'authenticated', 'authenticated',
  'demo-coach-' || lpad(n::text, 2, '0') || '@example.com',
  extensions.crypt('LocalDemoOnly123!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', '더미 코치 ' || lpad(n::text, 2, '0')),
  now(), now(), '', '', '', ''
from generate_series(3, 10) as n
on conflict (id) do nothing;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  id, email, id, jsonb_build_object('sub', id::text, 'email', email),
  'email', now(), now(), now()
from auth.users
where id between
  '10000000-0000-0000-0000-000000000003'::uuid and
  '10000000-0000-0000-0000-000000000010'::uuid
on conflict (provider_id, provider) do nothing;

-- 회원 10명
insert into public.members (
  id, name, phone, fixed_weekdays, status, memo, important_memo, joined_at
)
values
  ('20000000-0000-0000-0000-000000000001', '데모회원01', null, array[1,3,5]::smallint[], 'active', '오른손 펜홀더', '무릎 상태 확인', current_date - 180),
  ('20000000-0000-0000-0000-000000000002', '데모회원02', null, array[2,4]::smallint[], 'active', '포핸드 드라이브 연습 중', null, current_date - 150),
  ('20000000-0000-0000-0000-000000000003', '데모회원03', null, array[1,4]::smallint[], 'active', '레슨 전 스트레칭 권장', null, current_date - 120),
  ('20000000-0000-0000-0000-000000000004', '데모회원04', null, array[2,5]::smallint[], 'active', '백핸드 기본기 연습', null, current_date - 100),
  ('20000000-0000-0000-0000-000000000005', '데모회원05', null, array[3,6]::smallint[], 'active', '주말 오전 선호', null, current_date - 90),
  ('20000000-0000-0000-0000-000000000006', '데모회원06', null, array[1,3]::smallint[], 'active', '커트 리시브 집중', null, current_date - 75),
  ('20000000-0000-0000-0000-000000000007', '데모회원07', null, array[4,6]::smallint[], 'active', '개인 라켓 보관 중', null, current_date - 60),
  ('20000000-0000-0000-0000-000000000008', '데모회원08', null, array[2,5]::smallint[], 'active', '수비 전형', '손목 통증 여부 확인', current_date - 45),
  ('20000000-0000-0000-0000-000000000009', '데모회원09', null, array[3,7]::smallint[], 'active', '출장이 잦음', null, current_date - 40),
  ('20000000-0000-0000-0000-000000000010', '데모회원10', null, array[1,5]::smallint[], 'active', '초급 과정 진행 중', null, current_date - 30)
on conflict (id) do nothing;

-- 회원 식별 및 탁구 실력대 확인용 더미 정보
update public.members as member
set
  birth_date = sample.birth_date,
  skill_division = sample.skill_division
from (values
  ('20000000-0000-0000-0000-000000000001'::uuid, '2000-01-01'::date, '지역 4부'),
  ('20000000-0000-0000-0000-000000000002'::uuid, '2000-01-01'::date, '지역 5부'),
  ('20000000-0000-0000-0000-000000000003'::uuid, '2000-01-01'::date, '지역 3부'),
  ('20000000-0000-0000-0000-000000000004'::uuid, '2000-01-01'::date, '지역 6부'),
  ('20000000-0000-0000-0000-000000000005'::uuid, '2000-01-01'::date, '지역 5부'),
  ('20000000-0000-0000-0000-000000000006'::uuid, '2000-01-01'::date, '지역 2부'),
  ('20000000-0000-0000-0000-000000000007'::uuid, '2000-01-01'::date, '지역 6부'),
  ('20000000-0000-0000-0000-000000000008'::uuid, '2000-01-01'::date, '지역 4부'),
  ('20000000-0000-0000-0000-000000000009'::uuid, '2000-01-01'::date, '초심부'),
  ('20000000-0000-0000-0000-000000000010'::uuid, '2000-01-01'::date, '지역 5부')
) as sample(id, birth_date, skill_division)
where member.id = sample.id;

-- 회원별 QR 토큰 10건. 테스트용 원문은 demo-member-01 ~ demo-member-10이다.
insert into public.member_qr_tokens (
  id, member_id, token_hash, is_active, issued_by, qr_path
)
select
  ('30000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('20000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  encode(extensions.digest('demo-member-' || lpad(n::text, 2, '0'), 'sha256'), 'hex'),
  true,
  '10000000-0000-0000-0000-000000000001',
  null
from generate_series(1, 10) as n
on conflict (id) do nothing;

-- 활성 레슨권 10건
insert into public.lesson_passes (
  id, member_id, product_name, total_count, used_count, start_date,
  paid_at, paid_amount, payment_method, status, created_by, memo
)
values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '8회 레슨권', 8, 5, current_date - 40, current_date - 40, 240000, '카드', 'active', '10000000-0000-0000-0000-000000000001', '더미 결제'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '8회 레슨권', 8, 6, current_date - 45, current_date - 45, 240000, '계좌이체', 'active', '10000000-0000-0000-0000-000000000001', '잔여 2회 경고용'),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '8회 레슨권', 8, 8, current_date - 65, current_date - 65, 240000, '카드', 'active', '10000000-0000-0000-0000-000000000001', '승인 불가 확인용'),
  ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', '8회 레슨권', 8, 1, current_date - 20, current_date - 20, 240000, '현금', 'active', '10000000-0000-0000-0000-000000000001', '정상 사용'),
  ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', '8회 레슨권', 8, 2, current_date - 25, current_date - 25, 240000, '카드', 'active', '10000000-0000-0000-0000-000000000001', '정상 사용'),
  ('40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', '8회 레슨권', 8, 3, current_date - 30, current_date - 30, 240000, '계좌이체', 'active', '10000000-0000-0000-0000-000000000001', '정상 사용'),
  ('40000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', '8회 레슨권', 8, 7, current_date - 50, current_date - 50, 240000, '카드', 'active', '10000000-0000-0000-0000-000000000001', '잔여 1회 경고용'),
  ('40000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', '8회 레슨권', 8, 4, current_date - 35, current_date - 35, 240000, '현금', 'active', '10000000-0000-0000-0000-000000000001', '정상 사용'),
  ('40000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', '8회 레슨권', 8, 2, current_date - 55, current_date - 55, 240000, '카드', 'active', '10000000-0000-0000-0000-000000000001', '더미 회원'),
  ('40000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000010', '8회 레슨권', 8, 0, current_date - 10, current_date - 10, 240000, '계좌이체', 'active', '10000000-0000-0000-0000-000000000001', '신규 회원')
on conflict (id) do nothing;

-- 출석 요청 및 처리 기록 10건: 대기 3, 승인 5, 거절 1, 취소 1
insert into public.lesson_records (
  id, member_id, lesson_pass_id, actual_coach_id, request_method,
  requested_at, lesson_date, daily_sequence, approved_at, approved_by,
  status, deducted_count, rejected_at, rejected_by, rejection_reason,
  cancelled_at, cancelled_by, cancellation_reason, note
)
values
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', null, null, 'qr', now() - interval '2 minutes', public.business_date(), null, null, null, 'pending', 0, null, null, null, null, null, null, '승인 대기 테스트'),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', null, null, 'qr', now() - interval '5 minutes', public.business_date(), null, null, null, 'pending', 0, null, null, null, null, null, null, '잔여 2회 경고 테스트'),
  ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', null, null, 'coach_manual', now() - interval '12 minutes', public.business_date(), null, null, null, 'pending', 0, null, null, null, null, null, null, '레슨권 소진 테스트'),
  ('50000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'qr', now() - interval '70 minutes', public.business_date(), 1, now() - interval '68 minutes', '10000000-0000-0000-0000-000000000001', 'approved', 1, null, null, null, null, null, null, '오늘 승인'),
  ('50000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'qr', now() - interval '130 minutes', public.business_date(), 1, now() - interval '128 minutes', '10000000-0000-0000-0000-000000000001', 'approved', 1, null, null, null, null, null, null, '오늘 승인'),
  ('50000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'coach_manual', now() - interval '190 minutes', public.business_date(), 1, now() - interval '187 minutes', '10000000-0000-0000-0000-000000000001', 'approved', 1, null, null, null, null, null, null, '직접 출석 승인'),
  ('50000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', 'qr', now() - interval '1 day', public.business_date() - 1, 1, now() - interval '23 hours 58 minutes', '10000000-0000-0000-0000-000000000001', 'approved', 1, null, null, null, null, null, null, '어제 승인'),
  ('50000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', null, null, 'qr', now() - interval '50 minutes', public.business_date(), null, null, null, 'rejected', 0, now() - interval '48 minutes', '10000000-0000-0000-0000-000000000001', '방문 취소', null, null, null, '오늘 거절'),
  ('50000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000002', 'outage_recovery', now() - interval '2 days', public.business_date() - 2, 1, now() - interval '47 hours 58 minutes', '10000000-0000-0000-0000-000000000001', 'cancelled', 0, null, null, null, now() - interval '47 hours', '10000000-0000-0000-0000-000000000001', '중복 등록 확인', '취소 및 복구 테스트'),
  ('50000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000002', 'qr', now() - interval '250 minutes', public.business_date(), 1, now() - interval '247 minutes', '10000000-0000-0000-0000-000000000001', 'approved', 1, null, null, null, null, null, null, '신규 회원 첫 승인')
on conflict (id) do nothing;

-- 레슨권 수동 조정 이력 10건
insert into public.pass_adjustments (
  id, lesson_pass_id, adjustment_count, reason, adjusted_by
)
select
  ('60000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('40000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  case when n % 2 = 0 then 1 else -1 end,
  '더미 수동 조정 기록 ' || lpad(n::text, 2, '0'),
  '10000000-0000-0000-0000-000000000001'
from generate_series(1, 10) as n
on conflict (id) do nothing;

-- 트리거 감사 로그와 구분되는 명시적 화면 확인용 감사 기록 10건
insert into public.audit_logs (
  id, entity_type, entity_id, action, after_data, reason, actor_id
)
select
  ('70000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'seed_demo',
  ('20000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'seed_insert',
  jsonb_build_object('member_number', n),
  '더미 데이터 생성',
  '10000000-0000-0000-0000-000000000001'
from generate_series(1, 10) as n
on conflict (id) do nothing;

-- 승인 대기 화면 추가 검증용 회원 10명
insert into public.members (
  id, name, phone, fixed_weekdays, status, memo, important_memo, joined_at
)
values
  ('21000000-0000-0000-0000-000000000011', '데모회원11', null, array[1,3]::smallint[], 'active', '드라이브 자세 교정 중', null, current_date - 70),
  ('21000000-0000-0000-0000-000000000012', '데모회원12', null, array[2,4]::smallint[], 'active', '백핸드 집중 연습', null, current_date - 65),
  ('21000000-0000-0000-0000-000000000013', '데모회원13', null, array[3,5]::smallint[], 'active', '커트 리시브 연습', null, current_date - 60),
  ('21000000-0000-0000-0000-000000000014', '데모회원14', null, array[1,4]::smallint[], 'active', '초급 기본기 과정', null, current_date - 55),
  ('21000000-0000-0000-0000-000000000015', '데모회원15', null, array[2,5]::smallint[], 'active', '풋워크 집중 연습', null, current_date - 50),
  ('21000000-0000-0000-0000-000000000016', '데모회원16', null, array[3,6]::smallint[], 'active', '포핸드 안정화 중', null, current_date - 45),
  ('21000000-0000-0000-0000-000000000017', '데모회원17', null, array[1,5]::smallint[], 'active', '서브 연습 요청', null, current_date - 40),
  ('21000000-0000-0000-0000-000000000018', '데모회원18', null, array[2,6]::smallint[], 'active', '게임 운영 연습', null, current_date - 35),
  ('21000000-0000-0000-0000-000000000019', '데모회원19', null, array[3,5]::smallint[], 'active', '블록 연습 중', null, current_date - 30),
  ('21000000-0000-0000-0000-000000000020', '데모회원20', null, array[1,4]::smallint[], 'active', '첫 레슨 진행 예정', '초보 회원', current_date - 20)
on conflict (id) do nothing;

update public.members as member
set
  birth_date = sample.birth_date,
  skill_division = sample.skill_division
from (values
  ('21000000-0000-0000-0000-000000000011'::uuid, '2000-01-01'::date, '지역 3부'),
  ('21000000-0000-0000-0000-000000000012'::uuid, '2000-01-01'::date, '지역 6부'),
  ('21000000-0000-0000-0000-000000000013'::uuid, '2000-01-01'::date, '지역 5부'),
  ('21000000-0000-0000-0000-000000000014'::uuid, '2000-01-01'::date, '초심부'),
  ('21000000-0000-0000-0000-000000000015'::uuid, '2000-01-01'::date, '지역 4부'),
  ('21000000-0000-0000-0000-000000000016'::uuid, '2000-01-01'::date, '지역 5부'),
  ('21000000-0000-0000-0000-000000000017'::uuid, '2000-01-01'::date, '지역 2부'),
  ('21000000-0000-0000-0000-000000000018'::uuid, '2000-01-01'::date, '지역 6부'),
  ('21000000-0000-0000-0000-000000000019'::uuid, '2000-01-01'::date, '지역 3부'),
  ('21000000-0000-0000-0000-000000000020'::uuid, '2000-01-01'::date, '지역 5부')
) as sample(id, birth_date, skill_division)
where member.id = sample.id;

insert into public.member_qr_tokens (
  id, member_id, token_hash, is_active, issued_by, qr_path
)
select
  ('31000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('21000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  encode(extensions.digest('approval-demo-' || lpad(n::text, 2, '0'), 'sha256'), 'hex'),
  true,
  '10000000-0000-0000-0000-000000000001',
  null
from generate_series(11, 20) as n
on conflict (id) do nothing;

-- 권장 소진일 경과 화면 검증용 회원 및 활성 레슨권 15건
insert into public.members (
  id, name, phone, birth_date, skill_division, fixed_weekdays,
  status, memo, joined_at
)
select
  ('22000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '소진일경과' || lpad(n::text, 2, '0'),
  null::text,
  date '2000-01-01',
  case when n % 3 = 0 then '지역 3부' when n % 3 = 1 then '지역 4부' else '지역 5부' end,
  array[((n - 1) % 7 + 1)::smallint, ((n + 1) % 7 + 1)::smallint],
  'active',
  '권장 소진일 경과 화면 검증용 더미 회원',
  current_date - (120 + n)
from generate_series(1, 15) as n
on conflict (id) do nothing;

insert into public.lesson_passes (
  id, member_id, product_name, total_count, used_count, start_date,
  paid_at, paid_amount, payment_method, status, created_by, memo
)
select
  ('42000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('22000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '8회 레슨권',
  8,
  ((n - 1) % 7)::smallint,
  current_date - (80 + n),
  current_date - (80 + n),
  0,
  '더미',
  'active',
  '10000000-0000-0000-0000-000000000001',
  '권장 소진일 경과 목록 검증용'
from generate_series(1, 15) as n
on conflict (id) do nothing;

insert into public.lesson_passes (
  id, member_id, product_name, total_count, used_count, start_date,
  paid_at, paid_amount, payment_method, status, created_by, memo
)
select
  ('41000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('21000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '8회 레슨권',
  8,
  (n - 11) % 8,
  current_date - (n + 5),
  current_date - (n + 5),
  240000,
  case when n % 3 = 0 then '계좌이체' when n % 3 = 1 then '카드' else '현금' end,
  'active',
  '10000000-0000-0000-0000-000000000001',
  '추가 승인 대기 더미 레슨권'
from generate_series(11, 20) as n
on conflict (id) do nothing;

insert into public.lesson_records (
  id, member_id, request_method, requested_at, lesson_date, status,
  deducted_count, note
)
select
  ('51000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('21000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  case when n % 4 = 0 then 'coach_manual'::public.lesson_request_method else 'qr'::public.lesson_request_method end,
  now() - ((n - 10) * interval '3 minutes'),
  public.business_date(),
  'pending',
  0,
  '추가 승인 대기 테스트'
from generate_series(11, 20) as n
on conflict (id) do nothing;

-- 데모 회원은 상세 화면에서 성별 표시를 확인할 수 있도록 샘플 값을 채운다.
update public.members
set gender = case when mod(abs(hashtext(id::text)), 2) = 0 then 'male' else 'female' end
where gender is null;

