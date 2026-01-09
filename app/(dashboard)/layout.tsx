import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/lib/session";
import { Sidebar } from "@/app/components/layout/sidebar";
import { Topbar } from "@/app/components/layout/topbar";

export default async function DashboardLayout({
  children
}: {
  children: ReactNode;
}) {
  const { user } = await getCurrentSession();
  if (!user) {
    redirect("/login");
  }

  // UX-004: split layout with left nav + right reading pane
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar user={user} />
      <div className="flex flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 bg-slate-950 p-6">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
