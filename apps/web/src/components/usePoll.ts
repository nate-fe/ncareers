"use client";

import { useEffect, useRef, useState } from "react";

export const POLL_MS = 30_000;

/**
 * 30초마다 한 번씩 가져온다.
 *
 * - 탭이 가려져 있으면 쉬고, 다시 보이면 즉시 한 번 당겨 온 뒤 주기를 재개한다.
 *   보이지도 않는 화면을 위해 요청을 날릴 이유가 없다.
 * - 응답이 늦게 도착해 순서가 뒤집히면 오래된 응답은 버린다.
 * - 한 번 실패해도 멈추지 않고 다음 주기에 다시 시도한다.
 */
export function usePoll<T>(url: string, initial: T, intervalMs = POLL_MS) {
  const [data, setData] = useState<T>(initial);
  // 서버 렌더와 클라이언트의 시각이 어긋나면 하이드레이션이 깨지므로
  // 처음에는 비워 두고, 마운트된 뒤에 채운다.
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [failing, setFailing] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let alive = true;

    async function tick() {
      const mine = ++seq.current;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as T;
        if (!alive || mine !== seq.current) return; // 늦게 온 응답은 버린다
        setData(json);
        setUpdatedAt(Date.now());
        setFailing(false);
      } catch {
        if (alive) setFailing(true);
      }
    }

    function start() {
      if (timer) clearInterval(timer);
      timer = setInterval(tick, intervalMs);
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void tick();
        start();
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    setUpdatedAt(Date.now()); // 서버가 내려준 초기 데이터의 시각
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [url, intervalMs]);

  return { data, updatedAt, failing };
}

/** "오후 02:31:21에 업데이트" 문구. 마운트 전에는 빈 문자열을 돌려준다. */
export function useUpdatedLabel(updatedAt: number | null): string {
  if (updatedAt === null) return "";
  const time = new Date(updatedAt).toLocaleTimeString("ko-KR", {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${time}에 업데이트`;
}
