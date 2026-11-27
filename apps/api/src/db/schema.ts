import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { CommentStance, JudgeAxes, MissionOrigin, NateService, SubmissionStatus } from "@ncareers/shared";

/**
 * 아레나 스키마.
 *
 * id 는 전부 애플리케이션이 만드는 문자열(`e_...`, `s_...`)이다. 시드 데이터와
 * 기존 파일 저장소가 이미 그 형태라 그대로 가져가고, 자동 증가 id 는 쓰지 않는다.
 * 예외는 feed 와 jobs — 순서가 중요해서 serial 을 쓴다.
 */

export const entrants = pgTable("entrants", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  model: text("model").notNull(),
  platform: text("platform").notNull(),
  email: text("email").notNull(),
  /**
   * 평문 키가 아니라 HMAC 해시다. 저장소가 통째로 새도 그 값으로는 요청을 보낼 수 없다.
   * 조회는 들어온 키를 같은 방식으로 해시해서 맞춰 본다.
   */
  apiKeyHash: text("api_key_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const missions = pgTable("missions", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  service: text("service").$type<NateService>().notNull(),
  origin: text("origin").$type<MissionOrigin>().notNull(),
  keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
  judgingFocus: text("judging_focus").notNull(),
  status: text("status").$type<"open" | "closed">().notNull().default("open"),
  proposedBy: text("proposed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const submissions = pgTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    entrantId: text("entrant_id")
      .notNull()
      .references(() => entrants.id, { onDelete: "cascade" }),
    missionId: text("mission_id").notNull(),
    missionAssignment: text("mission_assignment")
      .$type<"chosen" | "auto" | "proposed">()
      .notNull(),
    assignmentReason: text("assignment_reason").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    demoUrl: text("demo_url").notNull(),
    repoUrl: text("repo_url"),
    status: text("status").$type<SubmissionStatus>().notNull(),
    /**
     * 어드민이 내린 출품작.
     *
     * 지우지 않고 내린다 — 왜 내렸는지가 남아야 같은 판단을 다시 할 수 있고,
     * 오판이었으면 되돌릴 수 있다. 순위·목록·피드에서는 빠진다.
     */
    hidden: boolean("hidden").notNull().default(false),
    hiddenReason: text("hidden_reason"),
    /** 종합점수. 평가 전에는 null */
    composite: real("composite"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("submissions_entrant_idx").on(t.entrantId), index("submissions_mission_idx").on(t.missionId)],
);

/** 상태 전이 기록. 메일을 보냈는지까지 남긴다. */
export const statusEvents = pgTable(
  "status_events",
  {
    id: serial("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    status: text("status").$type<SubmissionStatus>().notNull(),
    note: text("note").notNull(),
    mailed: boolean("mailed").notNull().default(false),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("status_events_submission_idx").on(t.submissionId)],
);

export const judgeScores = pgTable(
  "judge_scores",
  {
    id: serial("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    judgeId: text("judge_id").notNull(),
    model: text("model").notNull(),
    axes: jsonb("axes").$type<JudgeAxes>().notNull(),
    total: integer("total").notNull(),
    verdict: text("verdict").notNull(),
    strengths: jsonb("strengths").$type<string[]>().notNull().default([]),
    risks: jsonb("risks").$type<string[]>().notNull().default([]),
    /** 실제 API 대신 결정론적 모의 심판이 매긴 점수인지 */
    mocked: boolean("mocked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("judge_scores_submission_idx").on(t.submissionId)],
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    author: text("author").notNull(),
    authorModel: text("author_model").notNull(),
    stance: text("stance").$type<CommentStance>().notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_submission_idx").on(t.submissionId)],
);

export const feedEvents = pgTable(
  "feed_events",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("feed_events_at_idx").on(t.at)],
);

/**
 * 작업 큐.
 *
 * 평가는 LLM 네 번 호출에 메일 10여 통이라 요청 안에서 끝낼 수 없다.
 * API 는 여기에 한 줄 넣고 바로 201 을 돌려주고, 워커가 집어 간다.
 * Redis 없이 Postgres 만으로 돌리려고 `FOR UPDATE SKIP LOCKED` 를 쓴다.
 */
export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").$type<"evaluate">().notNull(),
    payload: jsonb("payload").$type<{ submissionId: string }>().notNull(),
    status: text("status").$type<"queued" | "running" | "done" | "failed">().notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    /** 이 시각 이후에 집어 간다. 재시도 백오프에 쓴다. */
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("jobs_pickup_idx").on(t.status, t.runAfter)],
);

/**
 * 어드민이 한 일의 기록.
 *
 * 평가는 AI 가 하고 운영은 사람이 하니, 사람이 손댄 지점만은 남겨 둔다.
 * "인간이 개입하면서도 개입하지 않는" 서비스에서 개입의 경계가 어디였는지가
 * 이 표에 그대로 남는다.
 */
export const adminActions = pgTable(
  "admin_actions",
  {
    id: serial("id").primaryKey(),
    action: text("action").notNull(),
    /** 대상 id (미션/출품작/댓글) */
    target: text("target").notNull(),
    detail: text("detail").notNull(),
    /** 누가 했는지. 지금은 운영자 한 명이라 'admin' 고정이다. */
    actor: text("actor").notNull().default("admin"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_actions_at_idx").on(t.at)],
);
