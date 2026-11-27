import Image from "next/image";
import nateBi from "@/images/nate-bi.png";

/**
 * ncareers 워드마크. 앞 글자 'n' 은 네이트 BI(배경 투명, 단색 #78BE20)를 그대로 쓴다.
 *
 * 원본 PNG 는 글리프가 캔버스 가운데 있지 않다 — 535×650 캔버스에서 실제 잉크는
 * x 16..518, y 138..622 이라 위쪽에 21%, 아래쪽에 4% 여백이 붙어 있다.
 * 그래서 이미지 높이를 그냥 글자 크기에 맞추면 'n' 이 베이스라인 아래로 흘러내린다.
 * 아래 비율은 그 잉크 상자를 기준으로 계산해, 잉크 밑변이 정확히 베이스라인에 앉고
 * 좌우 여백도 글자 사이 간격에서 빠지도록 음수 마진으로 걷어낸다.
 */
const CANVAS = { w: 535, h: 650 };
const INK = { top: 138, bottom: 622, left: 16, right: 518 };

const INK_H_RATIO = (INK.bottom - INK.top + 1) / CANVAS.h; // 0.7462
const INK_BOTTOM_RATIO = (CANVAS.h - 1 - INK.bottom) / CANVAS.h; // 0.0415
const INK_SIDE_RATIO = INK.left / CANVAS.w; // 0.0299
const CANVAS_ASPECT = CANVAS.w / CANVAS.h;

/** 잉크 높이를 글자 크기의 몇 배로 둘지. 0.70 = 맑은 고딕의 캡 하이트(브라우저에서 실측). */
const CAP_RATIO = 0.7;

export function Logo({
  size = 20,
  tone = "ink",
  className = "",
}: {
  /** 'careers' 글자 크기(px). 'n' 은 여기에 비례한다. */
  size?: number;
  /** 'careers' 글자색. 어두운 면 위에서는 "paper". */
  tone?: "ink" | "paper";
  className?: string;
}) {
  const imgH = (size * CAP_RATIO) / INK_H_RATIO;
  const imgW = imgH * CANVAS_ASPECT;
  const sideTrim = imgW * INK_SIDE_RATIO;
  const gap = size * 0.07;

  return (
    <span
      role="img"
      aria-label="ncareers"
      className={`inline-flex items-baseline leading-none ${className}`}
    >
      <Image
        src={nateBi}
        alt=""
        priority
        width={Math.ceil(imgW)}
        height={Math.ceil(imgH)}
        style={{
          height: imgH,
          width: imgW,
          // 베이스라인 정렬은 이미지의 '아래 마진 모서리'를 기준으로 하므로,
          // 캔버스 아래 여백만큼 내려 잉크 밑변을 베이스라인에 맞춘다.
          marginBottom: -imgH * INK_BOTTOM_RATIO,
          marginLeft: -sideTrim,
          marginRight: -sideTrim + gap,
        }}
      />
      <span
        aria-hidden="true"
        className={`font-bold tracking-tight ${tone === "paper" ? "text-on-deep" : "text-ink"}`}
        style={{ fontSize: size, lineHeight: 1 }}
      >
        careers
      </span>
    </span>
  );
}
