"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";

import { requireProfile } from "@/lib/auth/session";
import { errorMessage, withMessage } from "@/lib/forms/messages";
import { createClient } from "@/lib/supabase/server";
import { parseMemberInput } from "@/lib/validation/member";
import { getSiteOrigin } from "@/lib/env/server";

function nullable(value: string) {
  return value || null;
}

async function ensureMemberIsUnique(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: { name: string; phone: string; birth_date: string },
  excludedMemberId?: string,
) {
  let phoneQuery = supabase.from("members").select("id").eq("phone", input.phone);
  let identityQuery = supabase.from("members").select("id").eq("name", input.name).eq("birth_date", input.birth_date);
  if (excludedMemberId) {
    phoneQuery = phoneQuery.neq("id", excludedMemberId);
    identityQuery = identityQuery.neq("id", excludedMemberId);
  }
  const [phoneResult, identityResult] = await Promise.all([
    phoneQuery.limit(1).maybeSingle(),
    identityQuery.limit(1).maybeSingle(),
  ]);
  if (phoneResult.error) throw phoneResult.error;
  if (identityResult.error) throw identityResult.error;
  if (phoneResult.data) throw new Error("이미 등록된 전화번호입니다. 기존 회원을 확인해 주세요.");
  if (identityResult.data) throw new Error("이름과 생년월일이 같은 회원이 이미 있습니다. 동명이인 여부를 확인해 주세요.");
}

async function uploadPhoto(memberId: string, photo: FormDataEntryValue | null) {
  if (!(photo instanceof File) || photo.size === 0) {
    return null;
  }

  if (photo.size > 5 * 1024 * 1024) {
    throw new Error("회원 사진은 5MB 이하만 업로드할 수 있습니다.");
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
    throw new Error("회원 사진은 JPG, PNG, WEBP 형식만 가능합니다.");
  }

  const extension = photo.type === "image/jpeg" ? "jpg" : photo.type.split("/")[1];
  const path = `members/${memberId}/photos/${randomUUID()}.${extension}`;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from("member-private")
    .upload(path, photo, { contentType: photo.type, upsert: false });

  if (error) {
    throw error;
  }

  return path;
}

export async function createMember(formData: FormData) {
  await requireProfile(["admin"]);

  try {
    const input = parseMemberInput(formData);
    const supabase = await createClient();
    await ensureMemberIsUnique(supabase, input);
    const { data, error } = await supabase
      .from("members")
      .insert({
        name: input.name,
        phone: input.phone,
        birth_date: input.birth_date,
        gender: input.gender,
        skill_division: nullable(input.skill_division),
        status: input.status,
        joined_at: input.joined_at,
        memo: nullable(input.memo),
        important_memo: nullable(input.important_memo),
        fixed_weekdays: [...new Set(input.fixed_weekdays)].sort(),
      })
      .select("id")
      .single();

    if (error) throw error;

    const photoPath = await uploadPhoto(data.id, formData.get("photo"));
    if (photoPath) {
      const { error: photoError } = await supabase
        .from("members")
        .update({ photo_path: photoPath })
        .eq("id", data.id);
      if (photoError) throw photoError;
    }

    revalidatePath("/members");
    redirect(withMessage(`/members/${data.id}`, "success", "회원을 등록했습니다."));
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect(withMessage("/members/new", "error", errorMessage(error)));
  }
}

export async function updateMember(memberId: string, formData: FormData) {
  await requireProfile(["admin"]);

  try {
    const input = parseMemberInput(formData);
    const supabase = await createClient();
    await ensureMemberIsUnique(supabase, input, memberId);
    const photoPath = await uploadPhoto(memberId, formData.get("photo"));
    const { error } = await supabase
      .from("members")
      .update({
        name: input.name,
        phone: input.phone,
        birth_date: input.birth_date,
        gender: input.gender,
        skill_division: nullable(input.skill_division),
        status: input.status,
        joined_at: input.joined_at,
        memo: nullable(input.memo),
        important_memo: nullable(input.important_memo),
        fixed_weekdays: [...new Set(input.fixed_weekdays)].sort(),
        ...(photoPath ? { photo_path: photoPath } : {}),
      })
      .eq("id", memberId);

    if (error) throw error;

    revalidatePath("/members");
    revalidatePath(`/members/${memberId}`);
    redirect(withMessage(`/members/${memberId}`, "success", "회원 정보를 수정했습니다."));
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect(withMessage(`/members/${memberId}`, "error", errorMessage(error)));
  }
}

export async function issueMemberQr(memberId: string, formData: FormData) {
  await requireProfile(["admin"]);
  const reason = String(formData.get("reason") ?? "").trim();
  const supabase = await createClient();
  const { data: existingToken, error: existingTokenError } = await supabase
    .from("member_qr_tokens")
    .select("id")
    .eq("member_id", memberId)
    .eq("is_active", true)
    .maybeSingle();
  if (existingTokenError) {
    redirect(withMessage(`/members/${memberId}`, "error", errorMessage(existingTokenError)));
  }
  const isQrRecovery = Boolean(existingToken && !reason);
  const effectiveReason = reason || (existingToken ? "QR 이미지 누락으로 자동 복구" : null);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const qrPath = `members/${memberId}/qr/${randomUUID()}.svg`;

  try {
    const checkInUrl = `${getSiteOrigin()}/checkin#t=${encodeURIComponent(token)}`;
    const svg = await QRCode.toString(checkInUrl, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 2,
      width: 640,
    });
    const { error: uploadError } = await supabase.storage
      .from("member-private")
      .upload(qrPath, new Blob([svg], { type: "image/svg+xml" }), {
        contentType: "image/svg+xml",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { error } = await supabase.rpc("issue_member_qr", {
      p_member_id: memberId,
      p_token_hash: tokenHash,
      p_qr_path: qrPath,
      p_reissue_reason: effectiveReason,
    });

    if (error) {
      await supabase.storage.from("member-private").remove([qrPath]);
      throw error;
    }

    revalidatePath(`/members/${memberId}`);
    redirect(
      withMessage(
        `/members/${memberId}`,
        "success",
        isQrRecovery ? "QR 이미지를 복구해 발급했습니다." : reason ? "QR을 재발급했습니다." : "QR을 발급했습니다.",
      ),
    );
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect(withMessage(`/members/${memberId}`, "error", errorMessage(error)));
  }
}
