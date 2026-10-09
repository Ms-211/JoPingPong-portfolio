"use client";

import { useState } from "react";

import { MemberPhoneInput } from "@/components/member-phone-input";

const WEEKDAYS = [[1, "월"], [2, "화"], [3, "수"], [4, "목"], [5, "금"], [6, "토"], [7, "일"]] as const;

type MemberFormValue = {
  name: string;
  phone: string | null;
  birth_date: string | null;
  gender: "male" | "female" | null;
  skill_division: string | null;
  status: "active" | "ended";
  joined_at: string;
  memo: string | null;
  important_memo: string | null;
  fixed_weekdays: number[];
};

export function MemberForm({ action, member }: { action: (formData: FormData) => void | Promise<void>; member?: MemberFormValue }) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      <div className="member-detail-card-heading member-edit-heading">
        <div><h2>회원 정보 수정</h2><p>연락처, 생년월일, 성별, 부수와 운영 정보를 관리합니다.</p></div>
        <div className="member-edit-heading-actions">
          <button disabled={isEditing} onClick={() => setIsEditing(true)} type="button">수정</button>
          <button disabled={!isEditing} form="member-detail-edit-form" type="submit">확인</button>
        </div>
      </div>
      <form action={action} className="member-edit-form" id="member-detail-edit-form">
        <fieldset className="member-edit-fieldset" disabled={!isEditing}>
          <section className="member-edit-section basic">
        <h3>기본 정보</h3>
        <div className="member-edit-basic-grid member-edit-basic-grid-six">
          <label><span className="member-edit-label-text">이름 <b className="required">필수</b></span><input defaultValue={member?.name} maxLength={30} name="name" required /></label>
          <label><span className="member-edit-label-text">전화번호 <b className="required">필수</b></span><MemberPhoneInput defaultValue={member?.phone} /></label>
          <label><span className="member-edit-label-text">생년월일 <b className="required">필수</b></span><input defaultValue={member?.birth_date ?? ""} max={new Date().toISOString().slice(0, 10)} name="birth_date" required type="date" /></label>
          <label><span className="member-edit-label-text">성별 <b className="required">필수</b></span><select defaultValue={member?.gender ?? ""} name="gender" required><option disabled value="">선택해 주세요</option><option value="male">남성</option><option value="female">여성</option></select></label>
          <label><span className="member-edit-label-text">부수 <small>선택</small></span><input defaultValue={member?.skill_division ?? ""} maxLength={30} name="skill_division" placeholder="예: 지역 5부" /></label>
          <label><span className="member-edit-label-text">등록일</span><input defaultValue={member?.joined_at ?? new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)} name="joined_at" required type="date" /></label>
          <label><span className="member-edit-label-text">상태</span><select defaultValue={member?.status ?? "active"} name="status"><option value="active">이용 중</option><option value="ended">종료</option></select></label>
        </div>
          </section>

          <section className="member-edit-section schedule weekdays-only">
            <div className="member-edit-weekday-area"><h3>고정 레슨 요일</h3><div>{WEEKDAYS.map(([value, label]) => <label key={value}><input defaultChecked={member?.fixed_weekdays.includes(value)} name="fixed_weekdays" type="checkbox" value={value} /><span>{label}</span></label>)}</div></div>
          </section>

          <section className="member-edit-section memo"><h3>운영 메모</h3><div className="member-edit-memo-grid"><label className="important">중요 메모 <small>승인 화면에서 강조됩니다.</small><textarea defaultValue={member?.important_memo ?? ""} name="important_memo" placeholder="건강 상태, 수업 시 주의사항 등" rows={3} /></label><label>일반 메모 <small>회원 관리용 참고 사항입니다.</small><textarea defaultValue={member?.memo ?? ""} name="memo" placeholder="등록 경로, 선호 시간대 등" rows={3} /></label></div></section>

          <footer className="member-edit-footer"><label>회원 사진 <small>JPG, PNG, WEBP · 최대 5MB</small><input accept="image/jpeg,image/png,image/webp" name="photo" type="file" /></label></footer>
        </fieldset>
      </form>
    </>
  );
}
