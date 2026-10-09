alter table public.members
  add column birth_date date,
  add column skill_division text;

alter table public.members
  add constraint members_skill_division_length
  check (skill_division is null or length(trim(skill_division)) between 1 and 30);

comment on column public.members.birth_date is '동명이인 식별을 위한 회원 생년월일';
comment on column public.members.skill_division is '탁구 대회 기준 부수. 지역 및 대회별 표현 차이를 허용하는 선택 입력';
