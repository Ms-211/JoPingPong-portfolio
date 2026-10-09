import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();

  if (!profile) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data: qr, error: qrError } = await supabase
    .from("member_qr_tokens")
    .select("qr_path")
    .eq("member_id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (qrError) {
    return NextResponse.json({ error: "qr_lookup_failed" }, { status: 500 });
  }

  if (!qr?.qr_path) {
    return NextResponse.json({ error: "qr_not_found" }, { status: 404 });
  }

  const { data: qrFile, error: downloadError } = await supabase.storage
    .from("member-private")
    .download(qr.qr_path);

  if (downloadError || !qrFile) {
    return NextResponse.json({ error: "qr_download_failed" }, { status: 502 });
  }

  return new Response(await qrFile.arrayBuffer(), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": "inline; filename=member-qr.svg",
      "Content-Type": qrFile.type || "image/svg+xml",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
