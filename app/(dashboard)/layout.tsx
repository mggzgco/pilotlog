import { ReactNode } from "react";
import { requireUser } from "@/app/lib/auth/session";
import { Sidebar } from "@/app/components/layout/sidebar";
import { Topbar } from "@/app/components/layout/topbar";
import { ToastProvider } from "@/app/components/ui/toast-provider";

export default async function DashboardLayout({
  children
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  // UX-004: split layout with left nav + right reading pane
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Sidebar user={user} />
        <div className="flex flex-1 flex-col">
          <Topbar user={user} />
          <main className="app-main flex flex-1 flex-col bg-white p-4 sm:p-6 dark:bg-slate-950">
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
