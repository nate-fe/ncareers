/**
 * FE 와 BE 가 함께 쓰는 것만 모아 둔 꾸러미.
 *
 * 들어오는 기준: 양쪽이 똑같이 알아야 하는 "말"과 순수 계산. 타입, 화면 라벨,
 * 점수 공식, 심판 소개, 오가는 응답 모양.
 * 들어오지 않는 기준: 저장소, 메일, LLM 호출, 비밀값 — 전부 BE 몫이다.
 */
export * from "./types";
export * from "./scoring";
export * from "./judges";
export * from "./api-types";
