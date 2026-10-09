begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'members', 'members table exists');
select has_table('public', 'member_qr_tokens', 'member_qr_tokens table exists');
select has_table('public', 'lesson_passes', 'lesson_passes table exists');
select has_table('public', 'lesson_records', 'lesson_records table exists');
select has_table('public', 'pass_adjustments', 'pass_adjustments table exists');
select has_table('public', 'audit_logs', 'audit_logs table exists');

select col_default_is(
  'public',
  'lesson_passes',
  'total_count',
  '8',
  'a lesson pass defaults to eight lessons'
);

select is(
  (
    select is_generated::text
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lesson_passes'
      and column_name = 'recommended_use_by'
  ),
  'ALWAYS',
  'lesson pass recommended use-by date is generated from its payment date'
);

select has_index(
  'public',
  'member_qr_tokens',
  'member_qr_tokens_one_active_per_member',
  'only one active QR is allowed per member'
);

select has_index(
  'public',
  'lesson_records',
  'lesson_records_one_pending_per_member',
  'only one pending lesson request is allowed per member'
);

select has_index(
  'public',
  'lesson_records',
  'lesson_records_two_daily_approvals',
  'approved lesson slots are unique per member and day'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.members'::regclass),
  'members has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.lesson_passes'::regclass),
  'lesson_passes has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.lesson_records'::regclass),
  'lesson_records has RLS enabled'
);

select * from finish();
rollback;
