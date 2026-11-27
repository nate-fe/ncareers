/**
 * 어드민 화면이 쓰는 결과 코드.
 *
 * 서버 액션은 **코드만** 돌려주고, 사람이 읽는 문장은 화면이 이 표에서 찾습니다.
 * 주소창에는 아무것도 남지 않습니다 — 예전에는 `?err=비밀번호가+맞지+않습니다.`
 * 처럼 문장을 URL 에 실어 날랐는데, 그러면 새로고침해도 오류가 계속 남고
 * 링크를 복사해 보내면 남의 화면에도 뜹니다.
 *
 * 코드로 두면 문장을 고칠 때 이 파일만 고치면 되고, BE 가 보낸 메시지를 화면에
 * 그대로 흘리지 않게 됩니다 — BE 오류 문구에 내부 사정이 섞여 있어도 밖으로 안 나갑니다.
 */

export type AdminErrorCode =
  | "auth.bad-password"
  | "auth.too-many"
  | "auth.expired"
  | "auth.disabled"
  | "api.unreachable"
  | "api.unauthorized"
  | "input.reason-required"
  | "input.invalid"
  | "mission.in-use"
  | "not-found"
  | "unknown";

export type AdminOkCode =
  | "ok.signed-in"
  | "ok.mission-created"
  | "ok.mission-updated"
  | "ok.mission-opened"
  | "ok.mission-closed"
  | "ok.mission-deleted"
  | "ok.submission-hidden"
  | "ok.submission-unhidden"
  | "ok.submission-deleted"
  | "ok.submission-requeued";

export type AdminCode = AdminErrorCode | AdminOkCode;

/** 서버 액션이 돌려주는 것. null 이면 아직 아무 일도 없었습니다. */
export type ActionState = { status: "ok" | "error"; code: AdminCode } | null;

export const ok = (code: AdminOkCode): ActionState => ({ status: "ok", code });
export const err = (code: AdminErrorCode): ActionState => ({ status: "error", code });

const MESSAGE: Record<AdminCode, string> = {
  /* 로그인 */
  "auth.bad-password": "비밀번호가 맞지 않습니다.",
  "auth.too-many": "로그인 시도가 너무 잦습니다. 10분 뒤에 다시 시도하세요.",
  "auth.expired": "로그인이 만료되었습니다. 다시 들어와 주세요.",
  "auth.disabled": "어드민이 꺼져 있습니다. ADMIN_PASSWORD 와 ADMIN_API_TOKEN 을 설정하세요.",

  /* BE 와의 통신 */
  "api.unreachable": "아레나 서버에 연결하지 못했습니다. BE 가 떠 있는지 확인하세요.",
  "api.unauthorized": "어드민 토큰이 맞지 않습니다. FE 와 BE 의 ADMIN_API_TOKEN 이 같아야 합니다.",

  /* 입력 */
  "input.reason-required": "이유를 적어 주세요. 기록에 남습니다.",
  "input.invalid": "입력한 내용을 서버가 받지 않았습니다. 값을 다시 확인하세요.",

  /* 도메인 */
  "mission.in-use": "출품작이 붙어 있는 미션은 지울 수 없습니다. 닫기를 쓰세요.",
  "not-found": "대상을 찾을 수 없습니다. 다른 곳에서 이미 지워졌을 수 있습니다.",
  unknown: "처리하지 못했습니다. 잠시 뒤 다시 시도하세요.",

  /* 성공 */
  "ok.signed-in": "로그인했습니다.",
  "ok.mission-created": "미션을 열었습니다.",
  "ok.mission-updated": "미션을 수정했습니다.",
  "ok.mission-opened": "미션을 다시 열었습니다.",
  "ok.mission-closed": "미션을 닫았습니다.",
  "ok.mission-deleted": "미션을 지웠습니다.",
  "ok.submission-hidden": "출품작을 내렸습니다. 순위와 목록에서 빠집니다.",
  "ok.submission-unhidden": "출품작을 되돌렸습니다.",
  "ok.submission-deleted": "출품작을 완전히 지웠습니다.",
  "ok.submission-requeued": "평가를 다시 큐에 넣었습니다. 워커가 집어 가면 상태가 바뀝니다.",
};

export function messageOf(code: AdminCode): string {
  return MESSAGE[code] ?? MESSAGE.unknown;
}

/**
 * BE 가 준 HTTP 상태를 코드로 옮깁니다.
 *
 * BE 의 한국어 문장을 그대로 쓰지 않는 이유: 그 문장은 API 를 직접 부르는
 * 에이전트에게 맞춘 것이고, 운영 화면에서 할 말과는 다릅니다.
 */
export function codeForStatus(status: number): AdminErrorCode {
  switch (status) {
    case 0:
      return "api.unreachable";
    case 401:
      return "api.unauthorized";
    case 404:
      return "not-found";
    case 409:
      return "mission.in-use";
    case 400:
      return "input.invalid";
    case 503:
      return "auth.disabled";
    default:
      return "unknown";
  }
}
