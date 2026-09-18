"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { isNavItemActive, NAV_ITEMS } from "./nav-items";

/** The four most used sections live in the thumb zone; "Más" opens the full menu. */
const PRIMARY_ITEMS = NAV_ITEMS.slice(0, 4);
const SECONDARY_HREFS = NAV_ITEMS.slice(4).map((item) => item.href);

export function MobileNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const secondaryActive = SECONDARY_HREFS.some((href) => pathname === href || pathname.startsWith(`${href}/`));

  const itemClass = (active: boolean) =>
    cn(
      "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium leading-none transition-colors",
      active ? "text-primary" : "text-muted-foreground",
    );

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
    >
      <ul className="grid grid-cols-5">
        {PRIMARY_ITEMS.map((item) => {
          const active = isNavItemActive(item, pathname);
          return (
            <li key={item.href}>
              <Link href={item.href} className={itemClass(active)} aria-current={active ? "page" : undefined}>
                <item.icon className={cn("size-5", active && "fill-primary/10")} aria-hidden="true" />
                {item.title}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className={cn(itemClass(secondaryActive), "w-full")}
            onClick={() => setOpenMobile(true)}
            aria-label="Abrir menú completo"
          >
            <Menu className="size-5" aria-hidden="true" />
            Más
          </button>
        </li>
      </ul>
    </nav>
  );
}
