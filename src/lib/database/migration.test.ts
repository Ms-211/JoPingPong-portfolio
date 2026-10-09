import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260808000000_initial_schema.sql",
  ),
  "utf8",
);
const managementMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260809000000_member_qr_pass_management.sql",
  ),
  "utf8",
);
const memberGenderMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260822000000_add_member_gender.sql",
  ),
  "utf8",
);

describe("initial database migration", () => {
  it("fixes each purchased lesson pass at eight lessons", () => {
    expect(migration).toContain("lesson_passes_fixed_total");
    expect(migration).toMatch(/total_count\s*=\s*8/);
  });

  it("calculates an inclusive two-calendar-month recommended use-by date", () => {
    expect(migration).toContain("interval '2 months' - interval '1 day'");
    expect(managementMigration).toContain("recommended_use_by");
    expect(managementMigration).toContain("never changes status");
  });

  it("limits approved daily sequence values to one or two", () => {
    expect(migration).toMatch(/daily_sequence\s+in\s+\(1, 2\)/);
    expect(migration).toContain("lesson_records_two_daily_approvals");
  });

  it("stores only supported member gender values", () => {
    expect(memberGenderMigration).toContain("members_gender_valid");
    expect(memberGenderMigration).toContain("gender in ('male', 'female')");
  });

  it("enables RLS on every application table", () => {
    const enabledTables = [
      "profiles",
      "members",
      "member_qr_tokens",
      "lesson_passes",
      "lesson_records",
      "pass_adjustments",
      "audit_logs",
    ];

    for (const table of enabledTables) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
  });
});
