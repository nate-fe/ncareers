import { STATUS_LABEL, type JudgeScore, type Submission, type SubmissionStatus } from "@ncareers/shared";
import { JUDGES } from "@ncareers/shared";
import type { MailMessage } from "./index";
import { siteUrl } from "../site-url";



function shell(title: string, bodyLines: string[], submissionId: string): string {
  const url = `${siteUrl()}/submissions/${submissionId}`;
  return `<!doctype html><html lang="ko"><body style="margin:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Apple SD Gothic Neo',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;color:#6e6e73;text-transform:uppercase;">ncareers arena</p>
    <h1 style="margin:0 0 20px;font-size:22px;line-height:1.4;color:#333333;">${title}</h1>
    <div style="background:#ffffff;border:1px solid #e3e3e5;border-left:3px solid #78be20;border-radius:14px;padding:20px;">
      ${bodyLines.map((l) => `<p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#4f4f55;">${l}</p>`).join("")}
    </div>
    <a href="${url}" style="display:inline-block;margin-top:18px;background:#78be20;color:#232326;text-decoration:none;padding:11px 18px;border-radius:999px;font-size:13px;font-weight:700;">출품작 현황 보기</a>
    <p style="margin:24px 0 0;font-size:12px;color:#6e6e73;line-height:1.6;">이 메일은 아레나 상태가 바뀔 때마다 자동으로 나갑니다. 상위 랭킹 출품작은 ncareers 메인에 노출됩니다.</p>
  </div></body></html>`;
}

function toText(title: string, lines: string[], submissionId: string): string {
  return [title, "", ...lines.map((l) => l.replace(/<[^>]+>/g, "")), "", `${siteUrl()}/submissions/${submissionId}`].join("\n");
}

/** 상태 전이 메일 */
export function statusMail(submission: Submission, status: SubmissionStatus, note: string): MailMessage {
  const label = STATUS_LABEL[status];
  const title = `[${label}] ${submission.title}`;
  const lines = [
    `출품작 <b>${submission.title}</b> 의 상태가 <b>${label}</b> 로 바뀌었습니다.`,
    note,
    `심판 평가 완료: ${submission.judgeScores.length} / 4`,
  ];
  return { to: "", subject: title, html: shell(title, lines, submission.id), text: toText(title, lines, submission.id) };
}

/** 심판 한 명의 평가가 도착했을 때 */
export function judgeArrivedMail(submission: Submission, score: JudgeScore): MailMessage {
  const persona = JUDGES[score.judgeId];
  const title = `[평가 도착] ${persona.name} — ${score.total}점`;
  const lines = [
    `<b>${persona.name}</b> (${persona.vendor}${score.mocked ? ", 모의 채점" : ""}) 의 평가가 도착했습니다.`,
    `총점 <b>${score.total} / 100</b>`,
    `총평: ${score.verdict}`,
    score.risks.length ? `지적된 위험: ${score.risks.join(" / ")}` : "",
    `진행 상황: ${submission.judgeScores.length} / 4 심판 완료`,
  ].filter(Boolean);
  return { to: "", subject: title, html: shell(title, lines, submission.id), text: toText(title, lines, submission.id) };
}

/** 최종 점수 확정 */
export function finalScoreMail(submission: Submission, rank: number | null): MailMessage {
  const title = `[점수 확정] ${submission.title} — 종합 ${submission.composite}점`;
  const lines = [
    `네 심판의 평가가 모두 끝났습니다. 종합점수는 <b>${submission.composite}점</b> 입니다.`,
    rank ? `현재 순위: <b>${rank}위</b>` : "순위는 다음 갱신에 반영됩니다.",
    ...submission.judgeScores.map(
      (s) => `· ${JUDGES[s.judgeId].name}: ${s.total}점 — ${s.verdict.slice(0, 90)}…`,
    ),
    "상위권 출품작은 ncareers 메인 화면에 노출됩니다.",
  ];
  return { to: "", subject: title, html: shell(title, lines, submission.id), text: toText(title, lines, submission.id) };
}
