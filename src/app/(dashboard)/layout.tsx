import { cookies } from "next/headers";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireSession } from "@/server/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, cookieStore] = await Promise.all([requireSession(), cookies()]);
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar user={{ name: user.name, email: user.email }} />
      <SidebarInset>
        <Topbar />
        {/* Bottom padding keeps content clear of the mobile navigation bar. */}
        <main className="flex flex-1 flex-col gap-5 p-4 pb-24 md:gap-6 md:p-6">{children}</main>
        <MobileNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
