"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminApiError, adminFetch, isSignedIn, signIn, signOut } from "@/lib/admin";
import { codeForStatus, err, ok, type ActionState, type AdminOkCode } from "./errors";

/**
 * 어드민 화면의 동작.
 *
 * 전부 서버 액션이고, 결과는 **코드 하나**로 돌려줍니다 (`errors.ts`).
 * 주소창에는 아무것도 붙지 않습니다 — 폼이 useActionState 로 결과를 받아
 * 버튼 옆에 바로 그립니다. 그래서 새로고침하면 오류가 사라지고, 링크를
 * 복사해 보내도 남의 화면에 오류가 뜨지 않습니다.
 *
 * 어드민 토큰은 여기(서버)에서만 붙습니다. 브라우저로 내려가지 않습니다.
 */

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

/** 모든 쓰기의 공통 앞단: 로그인 확인 → BE 호출 → 코드. */
async function run(
  path: string,
  work: () => Promise<AdminOkCode>,
): Promise<ActionState> {
  if (!(await isSignedIn())) return err("auth.expired");
  try {
    const code = await work();
    revalidatePath(path);
    revalidatePath("/admin");
    return ok(code);
  } catch (e) {
    if (e instanceof AdminApiError) return err(codeForStatus(e.status));
    console.error("[admin]", e);
    return err("unknown");
  }
}

/* ───────────── 로그인 ───────────── */

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const result = await signIn(text(form, "password"));
  if (result === "too-many") return err("auth.too-many");
  if (result !== "ok") return err("auth.bad-password");
  // 쿠키가 생겼으니 레이아웃이 문지기를 다시 통과해야 합니다.
  revalidatePath("/admin");
  return ok("ok.signed-in");
}

export async function logoutAction(): Promise<void> {
  await signOut();
  revalidatePath("/admin");
  redirect("/admin");
}

/* ───────────── 미션 ───────────── */

export async function createMissionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run("/admin/missions", async () => {
    await adminFetch("/missions", {
      method: "POST",
      body: {
        title: text(form, "title"),
        summary: text(form, "summary"),
        service: text(form, "service"),
        judgingFocus: text(form, "judgingFocus"),
        keywords: text(form, "keywords")
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        status: text(form, "status") || "open",
      },
    });
    return "ok.mission-created";
  });
}

export async function editMissionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run("/admin/missions", async () => {
    await adminFetch(`/missions/${text(form, "id")}`, {
      method: "PATCH",
      body: {
        title: text(form, "title"),
        summary: text(form, "summary"),
        service: text(form, "service"),
        judgingFocus: text(form, "judgingFocus"),
        keywords: text(form, "keywords")
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      },
    });
    return "ok.mission-updated";
  });
}

export async function toggleMissionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run("/admin/missions", async () => {
    const next = text(form, "status") === "open" ? "closed" : "open";
    await adminFetch(`/missions/${text(form, "id")}`, {
      method: "PATCH",
      body: { status: next },
    });
    return next === "open" ? "ok.mission-opened" : "ok.mission-closed";
  });
}

export async function deleteMissionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run("/admin/missions", async () => {
    await adminFetch(`/missions/${text(form, "id")}`, { method: "DELETE" });
    return "ok.mission-deleted";
  });
}

/* ───────────── 출품작 ───────────── */

export async function hideSubmissionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const reason = text(form, "reason");
  if (!reason) return err("input.reason-required");

  return run("/admin/submissions", async () => {
    await adminFetch(`/submissions/${text(form, "id")}`, {
      method: "PATCH",
      body: { hidden: true, reason },
    });
    return "ok.submission-hidden";
  });
}

export async function unhideSubmissionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run("/admin/submissions", async () => {
    await adminFetch(`/submissions/${text(form, "id")}`, {
      method: "PATCH",
      body: { hidden: false },
    });
    return "ok.submission-unhidden";
  });
}

export async function deleteSubmissionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const reason = text(form, "reason");
  if (!reason) return err("input.reason-required");

  return run("/admin/submissions", async () => {
    await adminFetch(
      `/submissions/${text(form, "id")}?reason=${encodeURIComponent(reason)}`,
      { method: "DELETE" },
    );
    return "ok.submission-deleted";
  });
}

export async function requeueAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run("/admin/submissions", async () => {
    await adminFetch(`/submissions/${text(form, "id")}/requeue`, { method: "POST" });
    return "ok.submission-requeued";
  });
}
