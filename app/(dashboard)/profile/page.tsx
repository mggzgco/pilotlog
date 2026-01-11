import { requireUser } from "@/app/lib/auth/session";
import { prisma } from "@/app/lib/db";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { TimeZoneSelect } from "@/app/components/ui/timezone-select";
import { CreatePersonModal } from "@/app/components/people/create-person-modal";
import { EditPersonModal } from "@/app/components/people/edit-person-modal";

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  // Auto-link any existing People rows whose email matches an existing User account.
  // This keeps linking "automatic" even if the person was created before the user signed up.
  const peopleNeedingLink = await prisma.person.findMany({
    where: { userId: sessionUser.id, email: { not: null }, linkedUserId: null },
    select: { id: true, email: true }
  });
  if (peopleNeedingLink.length > 0) {
    const emails = Array.from(
      new Set(
        peopleNeedingLink
          .map((p) => p.email?.trim().toLowerCase())
          .filter((e): e is string => Boolean(e))
      )
    );
    if (emails.length > 0) {
      const matchingUsers = await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true }
      });
      const byEmail = new Map(matchingUsers.map((u) => [u.email, u.id]));
      const updates = peopleNeedingLink
        .map((p) => {
          const normalized = p.email?.trim().toLowerCase() ?? "";
          const userId = byEmail.get(normalized);
          if (!userId) return null;
          return { personId: p.id, linkedUserId: userId };
        })
        .filter(
          (u): u is { personId: string; linkedUserId: string } => u !== null
        );
      if (updates.length > 0) {
        await prisma.$transaction(
          updates.map((u) =>
            prisma.person.update({
              where: { id: u.personId },
              data: { linkedUserId: u.linkedUserId }
            })
          )
        );
      }
    }
  }

  const [user, people] = await Promise.all([
    prisma.user.findUnique({
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
    }),
    prisma.person.findMany({
      where: { userId: sessionUser.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, linkedUserId: true }
    })
  ]);

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">People</p>
              <p className="text-xs text-slate-500">
                Passengers, instructors, and others you fly with. Available in flight creation dropdowns.
              </p>
            </div>
            <CreatePersonModal />
          </div>
        </CardHeader>
        <CardContent>
          {people.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No people yet. Add your instructor/passengers here so you can quickly attach them to flights.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Linked</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {people.map((person) => (
                    <tr key={person.id} className="bg-white dark:bg-slate-950">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {person.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {person.email ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {person.linkedUserId ? (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                            Linked
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <EditPersonModal person={{ id: person.id, name: person.name, email: person.email }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
