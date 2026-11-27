/** "13시간 전" 같은 상대 시각. 서버에서만 계산해 하이드레이션 불일치를 피한다. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.round(hour / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export function clockKST(now = new Date()): string {
  return now.toLocaleTimeString("ko-KR", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
