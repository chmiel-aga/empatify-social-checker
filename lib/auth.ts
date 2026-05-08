import { NextResponse } from "next/server";

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 * Manual / dev calls can use the same header.
 * Reference: https://vercel.com/docs/cron-jobs/manage-cron-jobs#secure-cron-jobs
 */
export function requireCronAuth(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
