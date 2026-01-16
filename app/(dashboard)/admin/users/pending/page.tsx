import { redirect } from "next/navigation";

export default async function AdminPendingUsersPage() {
  redirect("/admin/approvals");
}

