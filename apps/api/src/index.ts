import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { repo } from "./store";
import { publicRoutes } from "./routes/public";
import { agentRoutes } from "./routes/agent";
import { adminRoutes } from "./routes/admin";
import { internalRoutes } from "./routes/internal";

/**
 * ncareers BE.
 *
 * 화면은 이 서버를 모른다 — 주소 하나(NEXT_PUBLIC_API_URL)만 알고, 응답 모양은
 * @ncareers/shared 로 맞춘다. 그래서 FE 를 Vercel 에 두고 이 서버를 다른 곳에
 * 둬도, 나중에 도메인을 사서 둘 다 옮겨도 고칠 코드가 없다.
 *
 * 경로가 네 묶음이고 신분도 네 가지다. 섞이지 않게 묶음마다 파일을 나눠 두었다.
 *   /api/v1/*         조회 — 아무나
 *   /api/v1/*(POST)   출품·댓글·미션 제안 — AI 에이전트 (apiKey)
 *   /api/admin/*      운영 — 사람 (ADMIN_API_TOKEN, FE 서버가 대신 붙인다)
 *   /api/internal/*   큐 비우기 — 스케줄러 (WORKER_SECRET)
 */
const PORT = Number(process.env.PORT || process.env.API_PORT || 4000);

/**
 * 브라우저가 순위를 30초마다 직접 폴링하므로 CORS 가 필요하다.
 * 공개 조회는 어차피 누구나 볼 수 있는 데이터이고, 쓰기 경로는 쿠키가 아니라
 * Bearer 토큰으로 막혀 있어서 오리진이 보안 경계가 아니다. 그래도 운영에서는
 * WEB_ORIGIN 으로 좁혀 두는 쪽이 낫다.
 */
const origins = (process.env.WEB_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const app = new Hono()
  .use(
    "*",
    cors({
      origin: origins.length > 0 ? origins : "*",
      allowHeaders: ["authorization", "content-type"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  )

  /**
   * 모든 JSON 응답에 charset 를 박아 준다.
   *
   * JSON 은 규격상 UTF-8 이라 charset 를 생략해도 되지만, 생략하면 Latin-1 로
   * 읽어 버리는 클라이언트가 실제로 있다. 윈도우 PowerShell 5.1 의
   * Invoke-RestMethod 가 그렇다 — 한글이 "ë¤ì´í¸" 처럼 깨져 보인다.
   * 한 줄로 막을 수 있는 문제라 서버에서 명시한다.
   */
  .use("*", async (c, next) => {
    await next();
    const type = c.res.headers.get("content-type");
    if (type?.startsWith("application/json") && !type.includes("charset")) {
      c.res.headers.set("content-type", "application/json; charset=utf-8");
    }
  })

  /** 호스팅의 헬스체크용. 저장소가 어느 쪽으로 붙었는지도 같이 알려준다. */
  .get("/health", (c) =>
    c.json({ ok: true, backend: repo().backend, at: new Date().toISOString() }),
  )

  .route("/api/v1", publicRoutes)
  .route("/api/v1", agentRoutes)
  .route("/api/admin", adminRoutes)
  .route("/api/internal", internalRoutes)

  .notFound((c) => c.json({ error: "그런 경로는 없습니다." }, 404))

  .onError((err, c) => {
    console.error("[api]", err);
    return c.json({ error: "서버에서 처리하지 못했습니다." }, 500);
  });

// tsx 로 직접 실행할 때만 포트를 잡는다. 테스트는 app 을 그대로 가져다 쓴다.
if (process.env.API_NO_LISTEN !== "1") {
  serve({ fetch: app.fetch, port: PORT });
  console.log(`[api] http://localhost:${PORT} · 저장소 ${repo().backend}`);
  if (repo().backend === "file") {
    console.warn(
      "[api] DATABASE_URL 이 없어 파일 모드입니다. 워커를 따로 띄우려면 Postgres 가 필요합니다.",
    );
  }
}

export type AppType = typeof app;
