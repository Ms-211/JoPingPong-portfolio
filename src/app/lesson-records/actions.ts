"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireProfile } from "@/lib/auth/session";
import { errorMessage, withMessage } from "@/lib/forms/messages";
import { createClient } from "@/lib/supabase/server";
import { postgresUuid } from "@/lib/validation/postgres-uuid";

const pastLessonSchema = z.object({
  memberId: postgresUuid("회원을 선택해 주세요."),
  lessonDate: z.iso.date("레슨일을 선택해 주세요."),
  actualCoachId: postgresUuid("실제 담당자를 선택해 주세요."),
  note: z.string().trim().max(500, "메모는 500자 이내로 입력해 주세요."),
});

export async function registerPastLesson(formData: FormData) {
  await requireProfile(["admin"]);

  try {
    const input = pastLessonSchema.parse({
      memberId: formData.get("member_id"),
      lessonDate: formData.get("lesson_date"),
      actualCoachId: formData.get("actual_coach_id"),
      note: formData.get("note") ?? "",
    });
    const supabase = await createClient();
    const { error } = await supabase.rpc("register_past_lesson", {
      p_member_id: input.memberId,
      p_lesson_date: input.lessonDate,
      p_actual_coach_id: input.actualCoachId,
      p_note: input.note || null,
    });
    if (error) throw error;

    revalidatePath("/dashboard");
    revalidatePath("/lesson-records");
    redirect(withMessage("/lesson-records", "success", "과거 레슨을 등록하고 레슨권 1회를 차감했습니다."));
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect(withMessage("/lesson-records", "error", errorMessage(error)));
  }
}
