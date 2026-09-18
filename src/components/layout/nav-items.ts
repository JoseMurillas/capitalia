import {
  ChartColumn,
  HandCoins,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Personas", href: "/personas", icon: Users },
  { title: "Préstamos", href: "/prestamos", icon: HandCoins },
  { title: "Pagos", href: "/pagos", icon: Receipt },
  { title: "Finanzas", href: "/finanzas", icon: Wallet },
  { title: "Reportes", href: "/reportes", icon: ChartColumn },
  { title: "Configuración", href: "/configuracion", icon: Settings },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => isNavItemActive(item, pathname));
}
