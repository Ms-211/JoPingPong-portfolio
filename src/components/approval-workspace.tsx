"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  approveSelectedLessons,
  rejectSelectedLessons,
} from "@/app/dashboard/actions";

export type ApprovalWorkspaceRow = {
  id: string;
  memberId: string;
  memberName: string;
  phone: string | null;
  birthDate: string | null;
  skillDivision: string | null;
  photoUrl?: string;
  memberStatus: "active" | "ended";
  memo: string | null;
  importantMemo: string | null;
  requestDate: string;
  requestTime: string;
  requestAgo: string;
  method: string;
  status: "pending" | "approved" | "rejected";
  remaining: number;
  usedCount: number;
  totalCount: number;
  paidAt: string | null;
  recommendedUseBy: string | null;
  recentLessons: Array<{ id: string; label: string }>;
  warnings: string[];
};

type Filter = "all" | "pending" | "approved" | "rejected";

const FILTER_LABELS: Record<Filter, string> = {
  all: "전체",
  pending: "대기",
  approved: "처리 완료",
  rejected: "거절",
};

function SubmitButton({
  children,
  secondary = false,
}: {
  children: string;
  secondary?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={secondary ? "approval-secondary-button" : "approval-primary-button"}
      disabled={pending}
      type="submit"
    >
      {pending ? "처리 중…" : children}
    </button>
  );
}

function Avatar({ row, large = false }: { row: ApprovalWorkspaceRow; large?: boolean }) {
  return row.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className={`approval-avatar${large ? " large" : ""}`} src={row.photoUrl} />
  ) : (
    <span className={`approval-avatar approval-avatar-placeholder${large ? " large" : ""}`}>
      {row.memberName.slice(0, 1)}
    </span>
  );
}

export function ApprovalWorkspace({ rows }: { rows: ApprovalWorkspaceRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("pending");
  const [selectedId, setSelectedId] = useState(rows.find((row) => row.status === "pending")?.id ?? rows[0]?.id);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmBulkApproval, setConfirmBulkApproval] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const filteredRows = useMemo(
    () => rows.filter((row) => {
      const matchesQuery = !normalizedQuery || row.memberName.toLocaleLowerCase("ko-KR").includes(normalizedQuery) || (row.phone ?? "").includes(normalizedQuery) || (row.birthDate ?? "").includes(normalizedQuery) || (row.skillDivision ?? "").toLocaleLowerCase("ko-KR").includes(normalizedQuery);
      const matchesFilter = filter === "all" || row.status === filter;
      return matchesQuery && matchesFilter;
    }),
    [filter, normalizedQuery, rows],
  );
  const selected = filteredRows.find((row) => row.id === selectedId) ?? filteredRows[0];
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const approvedCount = rows.filter((row) => row.status === "approved").length;
  const rejectedCount = rows.filter((row) => row.status === "rejected").length;
  const visiblePendingIds = filteredRows.filter((row) => row.status === "pending").map((row) => row.id);
  const allVisiblePendingSelected = visiblePendingIds.length > 0 && visiblePendingIds.every((id) => selectedIds.includes(id));

  function toggleAllVisible(checked: boolean) {
    setSelectedIds((current) => checked
      ? [...new Set([...current, ...visiblePendingIds])]
      : current.filter((id) => !visiblePendingIds.includes(id)));
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  }

  return (
    <>
      <section className="approval-stat-grid" aria-label="오늘 처리 현황">
        <button className={`approval-stat${filter === "pending" ? " active" : ""}`} onClick={() => { setFilter("pending"); setSelectedIds([]); }} type="button">
          <span>◷</span><div><small>승인 대기</small><strong>{pendingCount}<b>건</b></strong></div>
        </button>
        <button className={`approval-stat${filter === "approved" ? " active" : ""}`} onClick={() => { setFilter("approved"); setSelectedIds([]); }} type="button">
          <span>✓</span><div><small>오늘 승인</small><strong>{approvedCount}<b>건</b></strong></div>
        </button>
        <button className={`approval-stat${filter === "rejected" ? " active" : ""}`} onClick={() => { setFilter("rejected"); setSelectedIds([]); }} type="button">
          <span>×</span><div><small>오늘 거절</small><strong>{rejectedCount}<b>건</b></strong></div>
        </button>
      </section>
      <div className="approval-content-grid">
      <section className="approval-request-panel">
        <div className="approval-request-heading">
          <div>
            <h2>실시간 승인 요청</h2>
            <p>QR 및 직접 등록 요청을 확인한 뒤 처리하세요.</p>
          </div>
          <div className="approval-filter-tabs" aria-label="요청 상태 필터">
            {(["all", "pending", "approved", "rejected"] as const).map((value) => (
              <button className={filter === value ? "active" : ""} key={value} onClick={() => { setFilter(value); setSelectedIds([]); }} type="button">
                {FILTER_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
        <div className="approval-search-row">
          <label>
            <span aria-hidden="true">⌕</span>
            <input aria-label="회원 검색" enterKeyHint="search" inputMode="search" onInput={(event) => { setQuery(event.currentTarget.value); setSelectedIds([]); }} placeholder="이름, 전화번호 또는 생년월일 검색" spellCheck={false} type="search" value={query} />
          </label>
          <div className="approval-bulk-tools">
            <span>{selectedIds.length ? `${selectedIds.length}명 선택` : `${filteredRows.length}건`}</span>
            <button className="approval-select-all-button" disabled={!visiblePendingIds.length} onClick={() => toggleAllVisible(!allVisiblePendingSelected)} type="button">{allVisiblePendingSelected ? "전체 해제" : "전체 선택"}</button>
            <button className="approval-bulk-approve-button" disabled={!selectedIds.length} onClick={() => setConfirmBulkApproval(true)} type="button">선택 전체 승인</button>
          </div>
        </div>
        <div className="approval-list-head">
          <label className="approval-select-all"><input aria-label="현재 목록의 승인 대기 전체 선택" checked={allVisiblePendingSelected} disabled={!visiblePendingIds.length} onChange={(event) => toggleAllVisible(event.target.checked)} type="checkbox" /><span>전체 선택</span></label>
          <span>회원 정보</span><span>요청 날짜</span><span>요청 시각</span><span>{filter === "approved" ? "승인 후 잔여" : "현재 잔여"}</span><span>최근 레슨</span><span>상태</span><span>처리</span>
        </div>
        <div className="approval-request-list">
          {filteredRows.map((row) => (
            <article className={`approval-request-row${selected?.id === row.id ? " selected" : ""}`} key={row.id}>
              <label className="approval-row-check">
                {row.status === "pending" ? <input aria-label={`${row.memberName} 승인 선택`} checked={selectedIds.includes(row.id)} onChange={(event) => toggleOne(row.id, event.target.checked)} type="checkbox" /> : <span />}
              </label>
              <button className="approval-row-select" onClick={() => setSelectedId(row.id)} type="button">
                <span className="approval-member-summary"><Avatar row={row} /><span><strong>{row.memberName}</strong><small>{row.phone ?? "전화번호 없음"}</small></span></span>
                <span className="approval-request-date"><strong>{row.requestDate}</strong></span>
                <span className="approval-time"><strong>{row.requestTime}</strong><small>{row.requestAgo}</small></span>
                <span><strong className={row.remaining === 0 ? "approval-danger-text" : ""}>{row.remaining}회</strong><small>{row.status === "approved" ? `승인 후 사용 ${row.usedCount}회` : `현재 사용 ${row.usedCount}회`}</small></span>
                <span><strong>{row.recentLessons[0]?.label ?? "없음"}</strong><small>{row.method}</small></span>
                <span><b className={`approval-status ${row.status}`}>{row.status === "pending" ? "대기" : row.status === "approved" ? "승인" : "거절"}</b></span>
              </button>
              {row.status === "pending" ? (
                <div className="approval-row-actions">
                  <form action={approveSelectedLessons}>
                    <input name="record_ids" type="hidden" value={row.id} />
                    <input name="return_to" type="hidden" value="/approvals" />
                    <SubmitButton>승인</SubmitButton>
                  </form>
                  <form action={rejectSelectedLessons}>
                    <input name="record_ids" type="hidden" value={row.id} />
                    <input name="return_to" type="hidden" value="/approvals" />
                    <SubmitButton secondary>거절</SubmitButton>
                  </form>
                </div>
              ) : <span className="approval-processed">처리 완료</span>}
            </article>
          ))}
          {!filteredRows.length && <p className="dashboard-empty">조건에 맞는 요청이 없습니다.</p>}
        </div>
        <footer className="approval-list-footer">
          <span>ⓘ 중복 요청과 하루 2회 초과 승인은 시스템에서 차단됩니다.</span>
          <Link href="/lesson-records">전체 레슨 기록 보기</Link>
        </footer>
      </section>

      <aside className="approval-detail-panel">
        <h2>요청 상세</h2>
        {selected ? (
          <>
            <div className="approval-detail-member">
              <Avatar large row={selected} />
              <div><strong>{selected.memberName}</strong><span className={`approval-member-state ${selected.memberStatus}`}>{selected.memberStatus === "active" ? "활동 중" : "종료"}</span><small>{selected.phone ?? "전화번호 없음"}</small><small>{selected.birthDate ?? "생년월일 미등록"}{selected.skillDivision ? ` · ${selected.skillDivision}` : ""}</small></div>
            </div>
            <section className="approval-detail-section">
              <h3>레슨권 정보</h3>
              <dl>
                <div><dt>결제일</dt><dd>{selected.paidAt ?? "-"}</dd></div>
                <div><dt>권장 소진일</dt><dd>{selected.recommendedUseBy ?? "-"}</dd></div>
                <div><dt>{selected.status === "approved" ? "승인 당시 총 횟수" : "현재 총 횟수"}</dt><dd>{selected.totalCount}회</dd></div>
                <div><dt>{selected.status === "approved" ? "승인 후 사용 횟수" : "현재 사용 횟수"}</dt><dd>{selected.usedCount}회</dd></div>
                <div><dt>{selected.status === "approved" ? "승인 후 잔여 횟수" : "현재 잔여 횟수"}</dt><dd className="approval-danger-text">{selected.remaining}회</dd></div>
              </dl>
              {selected.warnings.map((warning) => <p className="approval-detail-warning" key={warning}>{warning}</p>)}
            </section>
            <section className="approval-detail-section">
              <h3>최근 출석 기록 <small>(최신 3건)</small></h3>
              {selected.recentLessons.map((lesson) => <p className="approval-history-row" key={lesson.id}><span>{lesson.label}</span><b>정상 출석</b></p>)}
              {!selected.recentLessons.length && <p className="muted">출석 기록이 없습니다.</p>}
            </section>
            {selected.status === "pending" && (
              <div className="approval-detail-actions">
                <p>승인하면 활성 레슨권에서 1회 차감됩니다.</p>
                <form action={approveSelectedLessons}>
                  <input name="record_ids" type="hidden" value={selected.id} />
                  <input name="return_to" type="hidden" value="/approvals" />
                  <SubmitButton>승인하고 1회 차감</SubmitButton>
                </form>
                <form action={rejectSelectedLessons}>
                  <input name="record_ids" type="hidden" value={selected.id} />
                  <input name="return_to" type="hidden" value="/approvals" />
                  <label>거절 사유<input name="rejection_reason" placeholder="선택 입력" /></label>
                  <SubmitButton secondary>요청 거절</SubmitButton>
                </form>
              </div>
            )}
          </>
        ) : <p className="dashboard-empty">왼쪽에서 요청을 선택하세요.</p>}
      </aside>

      {confirmBulkApproval && (
        <div className="approval-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmBulkApproval(false); }}>
          <section aria-labelledby="bulk-approval-title" aria-modal="true" className="approval-confirm-dialog" role="dialog">
            <span className="approval-confirm-icon">!</span>
            <h2 id="bulk-approval-title">전체 승인을 확인해 주세요</h2>
            <p><strong>{selectedIds.length}명</strong>이 전체 승인됩니다.</p>
            <p>확인하면 각 회원의 활성 레슨권에서 1회씩 차감되며, 처리 결과는 레슨 기록에 남습니다.</p>
            <form action={approveSelectedLessons} className="approval-confirm-actions">
              {selectedIds.map((id) => <input key={id} name="record_ids" type="hidden" value={id} />)}
              <input name="return_to" type="hidden" value="/approvals" />
              <button className="approval-secondary-button" onClick={() => setConfirmBulkApproval(false)} type="button">취소</button>
              <SubmitButton>{`확인하고 ${selectedIds.length}명 승인`}</SubmitButton>
            </form>
          </section>
        </div>
      )}
      </div>
    </>
  );
}
