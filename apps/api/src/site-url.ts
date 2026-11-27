/**
 * 사이트 주소.
 *
 * 메일 본문의 링크에 쓴다. 순서가 중요하다 —
 *   1. NEXT_PUBLIC_SITE_URL  직접 산 도메인. 나중에 이것만 바꾸면 된다.
 *   2. VERCEL_URL            Vercel 이 자동으로 넣어 주는 값. 지금 임시 배포용.
 *   3. localhost
 *
 * 2번은 Vercel 에서만 존재하지만, 없어도 1번·3번으로 돌아가므로
 * 다른 호스팅으로 옮길 때 이 파일을 고칠 필요가 없다.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}
