"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav() {
  const path = usePathname();
  if (["/host", "/tv"].some((p) => path.startsWith(p))) return null;
  return (
    <nav className="nav">
      <Link href="/" className={path === "/" ? "active" : ""}>
        <span aria-hidden>⚔️</span> Report a win
      </Link>
      <Link href="/board" className={path === "/board" ? "active" : ""}>
        <span aria-hidden>📜</span> Leaderboard
      </Link>
    </nav>
  );
}
