"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireProfile } from "@/lib/auth/session";
import { errorMessage, withMessage } from "@/lib/forms/messages";
import { createClient } from "@/lib/supabase/server";
import { postgresUuid } from "@/lib/validation/postgres-uuid";

const requestUuid = postgresUuid("올바른 요청 식별자가 아닙니다.");

const RESULT_MESSAGES: Record<string, string> = {
  created: "승인 대기를 직접 등록했습니다.",
  already_pending: "이미 승인 대기 중인 회원입니다.",
  daily_limit_reached: "오늘 승인 가능한 2회를 모두 처리한 회원입니다.",
};

const APPROVAL_FAILURE_LABELS: Record<string, string> = {
  member_ended: "이용 종료",
  no_available_pass: "사용 가능한 레슨권 없음",
  daily_limit_reached: "하루 2회 초과",
  already_approved: "이미 승인됨",
  already_rejected: "이미 거절됨",
  already_cancelled: "이미 취소됨",
  not_found: "기록 없음",
  error: "처리 오류",
};

function selectedRecordIds(formData: FormData) {
  const ids = formData
    .getAll("record_ids")
    .map(String)
    .filter((id) => requestUuid.safeParse(id).success);

  if (ids.length === 0) throw new Error("처리할 요청을 선택해 주세요.");
  if (ids.length > 100) throw new Error("한 번에 100건까지만 처리할 수 있습니다.");
  return [...new Set(ids)];
}

function approvalReturnTo(formData: FormData) {
  return formData.get("return_to") === "/approvals" ? "/approvals" : "/dashboard";
}

function resultSummary(
  results: Array<{ result_code: string }>,
  successCode: string,
  successLabel: string,
) {
  const successCount = results.filter((result) => result.result_code === successCode).length;
  const failures = new Map<string, number>();

  for (const result of results) {
    if (result.result_code === successCode) continue;
    const label = APPROVAL_FAILURE_LABELS[result.result_code] ?? result.result_code;
    failures.set(label, (failures.get(label) ?? 0) + 1);
  }

  const failureText = [...failures.entries()]
    .map(([label, count]) => `${label} ${count}건`)
    .join(", ");
  return {
    message: `${successLabel} ${successCount}건${failureText ? ` / 미처리: ${failureText}` : ""}`,
    isError: successCount === 0 || failures.size > 0,
  };
}

export async function registerManualCheckin(formData: FormData) {
  await requireProfile();
  const returnToMembers = formData.get("return_to") === "members";
  let returnTo = returnToMembers ? "/members" : "/dashboard";

  try {
    const parsedMemberId = requestUuid.safeParse(formData.get("member_id"));
    if (!parsedMemberId.success) {
      throw new Error("회원을 다시 선택해 주세요.");
    }
    const memberId = parsedMemberId.data;
    if (returnToMembers) {
      const filter = formData.get("member_filter") === "low" ? "&filter=low" : "";
      returnTo = `/members?selected=${memberId}${filter}`;
    }
    const supabase = await createClient();
    const [{ data, error }, { data: member, error: memberError }] = await Promise.all([
      supabase.rpc("request_manual_checkin", { p_member_id: memberId }),
      supabase.from("members").select("name").eq("id", memberId).maybeSingle(),
    ]);
    if (error) throw error;
    if (memberError) throw memberError;

    const memberName = member?.name ?? "선택한";
    const message = data === "created"
      ? `${memberName} 회원이 승인 대기 중입니다.`
      : data === "already_pending"
        ? `${memberName} 회원은 이미 승인 대기 중입니다.`
        : RESULT_MESSAGES[data as string] ?? "요청 상태를 확인했습니다.";

    revalidatePath("/dashboard");
    revalidatePath("/approvals");
    revalidatePath("/lesson-records");
    revalidatePath("/members");
    redirect(withMessage(returnTo, data === "created" ? "success" : "error", message));
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect(withMessage(returnTo, "error", errorMessage(error)));
  }
}

export async function approveSelectedLessons(formData: FormData) {
  await requireProfile();
  const returnTo = approvalReturnTo(formData);

  try {
    const ids = selectedRecordIds(formData);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("approve_lesson_records", {
      p_lesson_record_ids: ids,
    });
    if (error) throw error;

    const result = resultSummary(
      (data ?? []) as Array<{ result_code: string }>,
      "approved",
      "승인",
    );
    revalidatePath("/dashboard");
    revalidatePath("/approvals");
    revalidatePath("/lesson-records");
    redirect(withMessage(returnTo, result.isError ? "error" : "success", result.message));
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect(withMessage(returnTo, "error", errorMessage(error)));
  }
}

export async function rejectSelectedLessons(formData: FormData) {
  await requireProfile();
  const returnTo = approvalReturnTo(formData);

  try {
    const ids = selectedRecordIds(formData);
    const reason = String(formData.get("rejection_reason") ?? "").trim();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("reject_lesson_records", {
      p_lesson_record_ids: ids,
      p_reason: reason || null,
    });
    if (error) throw error;

    const result = resultSummary(
      (data ?? []) as Array<{ result_code: string }>,
      "rejected",
      "거절",
    );
    revalidatePath("/dashboard");
    revalidatePath("/approvals");
    revalidatePath("/lesson-records");
    redirect(withMessage(returnTo, "error", result.message));
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect(withMessage(returnTo, "error", errorMessage(error)));
  }
}

export async function cancelLessonApproval(formData: FormData) {
  await requireProfile(["admin"]);

  const requestedReturnTo = String(formData.get("return_to") ?? "/dashboard");
  const returnTo = requestedReturnTo === "/dashboard" || requestedReturnTo.startsWith("/lesson-records")
    ? requestedReturnTo
    : "/dashboard";

  try {
    const recordId = requestUuid.parse(formData.get("lesson_record_id"));
    const reason = z.string().trim().min(1, "승인 취소 사유를 입력해 주세요.").parse(
      formData.get("cancellation_reason"),
    );
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("cancel_lesson_approval", {
      p_lesson_record_id: recordId,
      p_reason: reason,
    });
    if (error) throw error;

    const message =
      data === "cancelled"
        ? "승인을 취소하고 원래 레슨권에 1회를 복구했습니다."
        : "이미 처리된 기록이어서 다시 취소하지 않았습니다.";
    revalidatePath("/dashboard");
    revalidatePath("/lesson-records");
    redirect(withMessage(returnTo, "error", message));
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect(withMessage(returnTo, "error", errorMessage(error)));
  }
}
