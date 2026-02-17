import Link from "next/link";

import { TopNavSection } from "@/types/dashboard";

interface TopBarProps {
  activeSection: TopNavSection;
}

function navClass(active: boolean): string {
  if (active) {
    return "border-b border-primary pb-0.5 text-primary";
  }
  return "text-text-muted transition-colors hover:text-text-main";
}

export function TopBar({ activeSection }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 mb-6 border-b border-border-light bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-start px-4 py-3 lg:px-6">
        <div className="flex items-center gap-8">
          <Link className="flex items-center gap-3" href="/indices-etfs">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-green-100 text-primary">▦</div>
            <span className="text-2xl font-bold tracking-tight text-text-main">FinBoard</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <Link className={navClass(activeSection === "indices_etfs")} href="/indices-etfs">
              Indices/ETFs
            </Link>
            <Link className={navClass(activeSection === "monedas")} href="/monedas">
              FX / Monedas
            </Link>
            <Link className={navClass(activeSection === "settings")} href="/ajustes">
              Ajustes
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
