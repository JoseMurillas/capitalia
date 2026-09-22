"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/finanzas", label: "Resumen", exact: true },
  { href: "/finanzas/movimientos", label: "Movimientos", exact: false },
  { href: "/finanzas/recurrentes", label: "Recurrentes", exact: false },
  { href: "/finanzas/tarjetas", label: "Tarjetas", exact: false },
  { href: "/finanzas/bandeja", label: "Bandeja", exact: false },
] as const;

/** Secondary navigation shared by every Finanzas page; sits right under the page header. */
export function FinanceNav({ pendingInbox }: { pendingInbox: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones de finanzas" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 border-b">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
                )}
              >
                {item.label}
                {item.href === "/finanzas/bandeja" && pendingInbox > 0 ? (
                  <Badge variant="secondary" className="tabular-nums">
                    {pendingInbox}
                  </Badge>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
