"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/shared/theme-toggle";

/**
 * Sticky shell header for the dashboard/admin areas. Hosts the sidebar toggle
 * (also Cmd/Ctrl+B), the page title, and the theme switch. The account menu
 * lives in the sidebar footer (`NavUser`).
 */
export function AppHeader({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur transition-[width,height] ease-linear md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      {title ? (
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
