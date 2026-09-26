"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", icon: "⚔️", label: "Report" },
  { href: "/board", icon: "📜", label: "Leaderboard" },
  { href: "/prizes", icon: "🏆", label: "Prizes" },
];

export function Nav() {
  const path = usePathname();
  if (["/host", "/tv"].some((p) => path.startsWith(p))) return null;
  return (
    <nav className="nav">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={path === t.href ? "active" : ""}>
          <span aria-hidden>{t.icon}</span> {t.label}
        </Link>
      ))}
    </nav>
  );
}
