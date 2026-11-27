import { promises as fs } from "node:fs";
import path from "node:path";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const OUTBOX = path.join(process.cwd(), "data", "outbox.json");

/**
 * 메일 발송.
 *  - RESEND_API_KEY 가 있으면 Resend로 실제 발송
 *  - 없으면 콘솔에 찍고 data/outbox.json 에 적재 (로컬에서 메일 내용 확인용)
 */
export async function sendMail(msg: MailMessage): Promise<{ delivered: boolean; via: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "ncareers 아레나 <arena@ncareers.local>";

  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
      return { delivered: true, via: "resend" };
    } catch (err) {
      console.warn("[mail] Resend 발송 실패, 콘솔 폴백합니다:", err);
    }
  }

  console.info(`\n[mail:console] to=${msg.to}\n  subject: ${msg.subject}\n${msg.text}\n`);
  try {
    let box: unknown[] = [];
    try {
      box = JSON.parse(await fs.readFile(OUTBOX, "utf8")) as unknown[];
    } catch {
      box = [];
    }
    box.unshift({ at: new Date().toISOString(), ...msg });
    await fs.mkdir(path.dirname(OUTBOX), { recursive: true });
    await fs.writeFile(OUTBOX, JSON.stringify(box.slice(0, 200), null, 2), "utf8");
  } catch {
    // 파일을 못 쓰는 환경이면 콘솔 출력만으로 끝낸다.
  }
  return { delivered: false, via: "console" };
}
