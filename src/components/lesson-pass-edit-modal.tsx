"use client";

import { useEffect, useState } from "react";

import { editLessonPass } from "@/app/lesson-passes/actions";

const EDITABLE_REMAINING_STATUSES = new Set(["active", "pending"]);

export type LessonPassEditValue = {
  id: string;
  memberId: string;
  memberName: string;
  paidAt: string;
  recommendedUseBy: string;
  remainingCount: number;
  status: string;
  statusLabel: string;
  memo: string | null;
};

export function LessonPassEditModal({ lessonPass }: { lessonPass: LessonPassEditValue }) {
  const [open, setOpen] = useState(false);
  const canEditRemaining = EDITABLE_REMAINING_STATUSES.has(lessonPass.status);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button className="passes-edit-trigger" onClick={() => setOpen(true)} type="button">레슨권 수정</button>
      {open && (
        <div className="passes-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section aria-labelledby={`lesson-pass-edit-${lessonPass.id}`} aria-modal="true" className="passes-register-modal passes-edit-modal" role="dialog">
            <header>
              <div>
                <h2 id={`lesson-pass-edit-${lessonPass.id}`}>레슨권 수정</h2>
                <p>{lessonPass.memberName} 회원의 레슨권 등록 정보를 정정합니다.</p>
              </div>
              <button aria-label="레슨권 수정 창 닫기" onClick={() => setOpen(false)} type="button">×</button>
            </header>

            <form action={editLessonPass}>
              <input name="lesson_pass_id" type="hidden" value={lessonPass.id} />
              <input name="member_id" type="hidden" value={lessonPass.memberId} />

              <section className="passes-edit-summary">
                <div><small>회원</small><strong>{lessonPass.memberName}</strong></div>
                <div><small>상태</small><span className={`passes-status ${lessonPass.status}`}>{lessonPass.statusLabel}</span></div>
                <div><small>현재 권장 소진일</small><strong>{lessonPass.recommendedUseBy}</strong></div>
              </section>

              <section className="passes-modal-step passes-edit-fields">
                <div className="passes-edit-primary-fields">
                  <label className="passes-modal-field">
                  <span className="passes-modal-field-title">등록일 <b className="required">필수</b></span>
                  <input defaultValue={lessonPass.paidAt} name="paid_at" required type="date" />
                  <small>등록일 기준 2개월로 소진일을 계산합니다.</small>
                  </label>
                  <label className="passes-modal-field">
                  <span className="passes-modal-field-title">잔여 횟수 <b className="required">필수</b></span>
                  <input defaultValue={lessonPass.remainingCount} disabled={!canEditRemaining} max={8} min={0} name="remaining_count" required type="number" />
                  {!canEditRemaining && <input name="remaining_count" type="hidden" value={lessonPass.remainingCount} />}
                  <small>{canEditRemaining ? "0~8회 조정 가능하며 이력이 기록됩니다." : "사용 중·사용 예정 레슨권만 조정할 수 있습니다."}</small>
                  </label>
                </div>
                <div className="passes-edit-note-fields">
                  <label className="passes-modal-memo">
                  <span className="passes-modal-field-title">메모 <small>선택 입력</small></span>
                  <textarea defaultValue={lessonPass.memo ?? ""} maxLength={2000} name="memo" placeholder="레슨권 관련 참고사항" rows={3} />
                  </label>
                  <label className="passes-modal-memo passes-edit-reason">
                  <span className="passes-modal-field-title">수정 사유 <b className="required">필수</b></span>
                  <textarea maxLength={500} name="reason" placeholder="예: 등록일 정정, 잔여 횟수 입력 오류" required rows={2} />
                  </label>
                </div>
              </section>

              <div className="passes-registration-rule">
                <strong>수정 전 확인</strong>
                <p>잘못 승인한 레슨은 레슨 기록의 ‘승인 취소·레슨권 복구’에서 처리해 주세요.</p>
              </div>

              <footer>
                <button onClick={() => setOpen(false)} type="button">취소</button>
                <button type="submit">레슨권 수정 확정</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
