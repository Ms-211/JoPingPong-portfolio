"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireProfile } from "@/lib/auth/session";
import { errorMessage, withMessage } from "@/lib/forms/messages";
import { createClient } from "@/lib/supabase/server";
import { postgresUuid } from "@/lib/validation/postgres-uuid";

const paymentSchema = z.object({
  member_id: postgresUuid("올바른 회원을 선택해 주세요."),
  paid_at: z.iso.date(),
  memo: z.string().trim().max(2000),
});

const lessonPassEditSchema = z.object({
  lesson_pass_id: postgresUuid("올바른 레슨권을 선택해 주세요."),
  member_id: postgresUuid("올바른 회원을 선택해 주세요."),
  paid_at: z.iso.date(),
  remaining_count: z.coerce.number().int().min(0).max(8),
  memo: z.string().trim().max(2000),
  reason: z.string().trim().min(1, "레슨권 수정 사유를 입력해 주세요.").max(500),
});

function lessonPassReturnTo(formData: FormData, memberId?: string) {
  const requested = String(formData.get("return_to") ?? "");
  if (memberId && requested === `/members/${memberId}`) return requested;
  return "/lesson-passes";
}

export async function registerLessonPass(formData: FormData) {
  await requireProfile(["admin"]);
  let returnTo = "/lesson-passes";

  try {
    const input = paymentSchema.parse({
      member_id: formData.get("member_id"),
      paid_at: formData.get("paid_at"),
      memo: formData.get("memo") ?? "",
    });
    returnTo = lessonPassReturnTo(formData, input.member_id);
    const supabase = await createClient();
    const { error } = await supabase.rpc("register_lesson_pass", {
      p_member_id: input.member_id,
      p_paid_at: input.paid_at,
      p_paid_amount: 0,
      p_payment_method: "미사용",
      p_memo: input.memo || null,
    });
    if (error) throw error;

    revalidatePath("/lesson-passes");
    revalidatePath(`/members/${input.member_id}`);
    redirect(withMessage(returnTo, "success", "8회 레슨권을 등록했습니다."));
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect(withMessage(returnTo, "error", errorMessage(error)));
  }
}

export async function manuallyExpireLessonPass(formData: FormData) {
  await requireProfile(["admin"]);

  const passId = String(formData.get("lesson_pass_id") ?? "");
  const memberId = String(formData.get("member_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  try {
    if (!postgresUuid().safeParse(passId).success || !reason) {
      throw new Error("수동 만료 사유를 입력해 주세요.");
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("manually_expire_lesson_pass", {
      p_lesson_pass_id: passId,
      p_reason: reason,
    });
    if (error) throw error;

    revalidatePath("/lesson-passes");
    if (memberId) revalidatePath(`/members/${memberId}`);
    redirect(withMessage("/lesson-passes", "success", "레슨권을 수동 만료 처리했습니다."));
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect(withMessage("/lesson-passes", "error", errorMessage(error)));
  }
}

export async function editLessonPass(formData: FormData) {
  await requireProfile(["admin"]);

  let memberId = "";

  try {
    const input = lessonPassEditSchema.parse({
      lesson_pass_id: formData.get("lesson_pass_id"),
      member_id: formData.get("member_id"),
      paid_at: formData.get("paid_at"),
      remaining_count: formData.get("remaining_count"),
      memo: formData.get("memo") ?? "",
      reason: formData.get("reason") ?? "",
    });
    memberId = input.member_id;
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_edit_lesson_pass", {
      p_lesson_pass_id: input.lesson_pass_id,
      p_paid_at: input.paid_at,
      p_remaining_count: input.remaining_count,
      p_memo: input.memo || null,
      p_reason: input.reason,
    });
    if (error) throw error;

    revalidatePath("/lesson-passes");
    revalidatePath(`/members/${memberId}`);
    redirect(withMessage("/lesson-passes", "success", "레슨권 정보를 수정했습니다."));
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect(withMessage("/lesson-passes", "error", errorMessage(error)));
  }
}
