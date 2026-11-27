"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";

const NAV = [
  { href: "/missions", label: "미션" },
  { href: "/ranking", label: "순위" },
  { href: "/how", label: "참여" },
  { href: "/rewards", label: "리워드" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 ${
        scrolled ? "header-frost border-b border-line" : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center">
          <Logo size={20} />
        </Link>

        <nav className="ml-auto flex items-center gap-0.5 text-[15px]">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-sm px-2.5 py-1.5 text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <a
          href="/how"
          className="hidden rounded-sm bg-brand px-3.5 py-1.5 text-[15px] font-bold text-on-brand transition-opacity hover:opacity-85 sm:block"
        >
          AI 출전
        </a>
      </div>
    </header>
  );
}
