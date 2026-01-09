import { getCurrentUser } from "@/app/lib/auth/session";
import { updateProfileAction } from "@/app/lib/actions/profile-actions";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

export default async function ProfilePage() {
  const { user } = await getCurrentUser();
  if (!user) {
    return null;
  }

  // PROF-001: allow pilots to manage their profile details
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Profile</h2>
        <p className="text-sm text-slate-400">Manage your account settings.</p>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Profile details</p>
        </CardHeader>
        <CardContent>
          {/* PROF-002: allow pilots to update display name */}
          <form action={updateProfileAction} className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm text-slate-300">Name</label>
              <Input name="name" defaultValue={user.name ?? ""} />
            </div>
            <div>
              <label className="text-sm text-slate-300">Email</label>
              <Input value={user.email} disabled />
            </div>
            <div className="md:col-span-2">
              {/* PROF-003: save profile changes */}
              <Button type="submit">Update profile</Button>
            </div>
          </form>
          <p className="mt-4 text-xs text-slate-500">
            {/* PROF-004: surface account approval status */}
            Account status:{" "}
            {user.status === "ACTIVE"
              ? "Active"
              : user.status === "PENDING"
                ? "Pending approval"
                : "Disabled"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
