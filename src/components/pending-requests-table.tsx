"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import {
  approveSelectedLessons,
  rejectSelectedLessons,
} from "@/app/dashboard/actions";

export type PendingRequestRow = {
  id: string;
  memberId: string;
  memberName: string;
  photoUrl?: string;
  requestTime: string;
  method: string;
  remaining: number;
  warnings: string[];
};

function ActionButton({
  children,
  disabled,
  className,
}: {
  children: string;
  disabled: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className}
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? "처리 중…" : children}
    </button>
  );
}

export function PendingRequestsTable({
  rows,
  totalCount = rows.length,
  compact = false,
}: {
  rows: PendingRequestRow[];
  totalCount?: number;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const allSelected = rows.length > 0 && selected.length === rows.length;

  function toggleAll(checked: boolean) {
    setSelected(checked ? rows.map((row) => row.id) : []);
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, id] : current.filter((item) => item !== id),
    );
  }

  return (
    <div className={`pending-processing-form${compact ? " compact" : ""}`}>
      <div className="pending-list-head">
        {compact ? <span>최근 {rows.length}건</span> : (
          <label className="pending-select-all">
            <input
              aria-label="승인 대기 전체 선택"
              checked={allSelected}
              onChange={(event) => toggleAll(event.target.checked)}
              type="checkbox"
            />
            전체 선택
          </label>
        )}
        <Link href="/approvals">전체 {totalCount}건 보기</Link>
      </div>
      <div className="dashboard-pending-list">
        {rows.map((row) => (
          <article className="dashboard-pending-row" key={row.id}>
            {!compact && (
              <input
                aria-label={`${row.memberName} 요청 선택`}
                checked={selected.includes(row.id)}
                onChange={(event) => toggleOne(row.id, event.target.checked)}
                type="checkbox"
              />
            )}
            <div className="member-cell dashboard-pending-member">
              {row.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="avatar" src={row.photoUrl} />
              ) : (
                <span className="avatar avatar-placeholder">{row.memberName.slice(0, 1)}</span>
              )}
              <div><Link href={`/members/${row.memberId}`}>{row.memberName}</Link><small>{row.requestTime} · {row.method}</small></div>
            </div>
            <span className="dashboard-remaining">남은 레슨 {row.remaining}회</span>
            <div className="dashboard-row-warnings">
              {row.warnings.length ? row.warnings.slice(0, 2).map((warning) => <span className="badge warning" key={warning}>{warning}</span>) : <span className="badge active">정상</span>}
            </div>
            <div className="pending-row-actions">
              <form action={approveSelectedLessons}>
                <input name="record_ids" type="hidden" value={row.id} />
                <ActionButton disabled={false}>승인</ActionButton>
              </form>
              <form action={rejectSelectedLessons}>
                <input name="record_ids" type="hidden" value={row.id} />
                <ActionButton className="outline-danger-button" disabled={false}>거절</ActionButton>
              </form>
            </div>
          </article>
        ))}
        {!rows.length && <p className="dashboard-empty">승인 대기 요청이 없습니다.</p>}
      </div>
      {!compact && rows.length > 0 && (
        <div className="pending-action-bar">
          <strong>{selected.length}건 선택</strong>
          <form action={rejectSelectedLessons}>
            {selected.map((id) => <input key={id} name="record_ids" type="hidden" value={id} />)}
            <label>
              거절 사유
              <input name="rejection_reason" placeholder="예: 방문 취소" />
            </label>
            <ActionButton className="danger-button" disabled={selected.length === 0}>선택 요청 거절</ActionButton>
          </form>
          <form action={approveSelectedLessons}>
            {selected.map((id) => <input key={id} name="record_ids" type="hidden" value={id} />)}
            <ActionButton disabled={selected.length === 0}>선택 승인 · 1회 차감</ActionButton>
          </form>
        </div>
      )}
    </div>
  );
}
