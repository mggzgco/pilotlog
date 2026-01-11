import { requireUser } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { TimeZoneSelect } from "@/app/components/ui/timezone-select";

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      phone: true,
      homeAirport: true,
      homeTimeZone: true,
      status: true
    }
  });

  if (!user) {
    return null;
  }

  const derivedFirstName = user.firstName ?? user.name?.split(" ")[0] ?? "";
  const derivedLastName =
    user.lastName ?? user.name?.split(" ").slice(1).join(" ") ?? "";

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
          <form action="/api/profile/update" method="post" className="grid gap-3 lg:grid-cols-2">
            <div>
              <label className="text-sm text-slate-300">First name</label>
              <Input name="firstName" defaultValue={derivedFirstName} />
            </div>
            <div>
              <label className="text-sm text-slate-300">Last name</label>
              <Input name="lastName" defaultValue={derivedLastName} />
            </div>
            <div>
              <label className="text-sm text-slate-300">Email</label>
              <Input value={user.email} disabled />
            </div>
            <div>
              <label className="text-sm text-slate-300">Phone</label>
              <Input name="phone" defaultValue={user.phone ?? ""} />
            </div>
            <div>
              <label className="text-sm text-slate-300">Home airport</label>
              <Input name="homeAirport" placeholder="KLOM" defaultValue={user.homeAirport ?? ""} />
            </div>
            <div>
              <label className="text-sm text-slate-300">Home time zone</label>
              <TimeZoneSelect name="homeTimeZone" defaultValue={user.homeTimeZone ?? undefined} />
              <p className="mt-1 text-xs text-slate-500">
                Used as the default time zone when creating flights.
              </p>
            </div>
            <div className="lg:col-span-2">
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

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Change password</p>
        </CardHeader>
        <CardContent>
          <form
            action="/api/profile/change-password"
            method="post"
            className="grid gap-3 lg:grid-cols-2"
          >
            <div>
              <label className="text-sm text-slate-300">Current password</label>
              <Input name="currentPassword" type="password" autoComplete="current-password" />
            </div>
            <div>
              <label className="text-sm text-slate-300">New password</label>
              <Input name="newPassword" type="password" autoComplete="new-password" />
            </div>
            <div>
              <label className="text-sm text-slate-300">Confirm new password</label>
              <Input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
              />
            </div>
            <div className="lg:col-span-2">
              <Button type="submit">Update password</Button>
              <p className="mt-2 text-xs text-slate-500">
                Changing your password will log you out of all sessions.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
