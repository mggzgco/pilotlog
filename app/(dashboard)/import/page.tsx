import { requireUser } from "@/app/lib/auth/session";
import { ImportClient } from "@/app/(dashboard)/import/import-client";

export default async function ImportPage() {
  await requireUser();

  return <ImportClient />;
}
