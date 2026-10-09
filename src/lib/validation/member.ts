import { z } from "zod";

import { koreaBusinessDate } from "@/lib/date/business-date";

function formatPhone(value: string) {
  const digits = value.replaceAll("-", "");
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

export const memberSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "이름을 입력해 주세요.")
    .max(30, "이름은 30자 이하로 입력해 주세요.")
    .refine((value) => /\p{L}/u.test(value), "이름에는 한글 또는 영문자가 포함되어야 합니다."),
  phone: z.string()
    .trim()
    .min(1, "전화번호를 입력해 주세요.")
    .regex(/^010(?:-?\d{4}){2}$/, "전화번호는 010-0000-0000 형식으로 입력해 주세요.")
    .transform(formatPhone),
  birth_date: z.iso.date("생년월일을 입력해 주세요.")
    .refine((value) => value <= koreaBusinessDate(), "생년월일은 미래 날짜일 수 없습니다."),
  gender: z.enum(["male", "female"], { message: "성별을 선택해 주세요." }),
  skill_division: z.string().trim().max(30, "부수는 30자 이하로 입력해 주세요."),
  status: z.enum(["active", "ended"]),
  joined_at: z.iso.date("등록일을 입력해 주세요.")
    .refine((value) => value <= koreaBusinessDate(), "등록일은 미래 날짜일 수 없습니다."),
  memo: z.string().trim().max(2000, "일반 메모는 2,000자 이하로 입력해 주세요."),
  important_memo: z.string().trim().max(1000, "중요 메모는 1,000자 이하로 입력해 주세요."),
  fixed_weekdays: z.array(z.coerce.number().int().min(1).max(7)),
});

export function parseMemberInput(formData: FormData) {
  return memberSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    birth_date: formData.get("birth_date"),
    gender: formData.get("gender"),
    skill_division: formData.get("skill_division") ?? "",
    status: formData.get("status") ?? "active",
    joined_at: formData.get("joined_at"),
    memo: formData.get("memo") ?? "",
    important_memo: formData.get("important_memo") ?? "",
    fixed_weekdays: formData.getAll("fixed_weekdays"),
  });
}
