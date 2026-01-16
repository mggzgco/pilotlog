"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import { adminUpdateUserProfileAction } from "@/app/lib/actions/admin-user-actions";

type EditUserModalProps = {
  user: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    role: "USER" | "ADMIN";
    status: "PENDING" | "ACTIVE" | "DISABLED";
    emailVerifiedAt: Date | null;
  };
  triggerLabel?: string;
  triggerClassName?: string;
};

export function EditUserModal({
  user,
  triggerLabel = "Edit user",
  triggerClassName
}: EditUserModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={triggerClassName}>
          {triggerLabel}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(42rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Edit user
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Update profile details and account status.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form action={adminUpdateUserProfileAction} className="mt-6 space-y-4">
            <input type="hidden" name="userId" value={user.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Email
                </p>
                <Input name="email" type="email" required defaultValue={user.email} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Name
                </p>
                <Input name="name" defaultValue={user.name ?? ""} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Phone
                </p>
                <Input name="phone" defaultValue={user.phone ?? ""} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Role
                </p>
                <select
                  name="role"
                  defaultValue={user.role}
                  className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status
                </p>
                <select
                  name="status"
                  defaultValue={user.status}
                  className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="PENDING">Pending</option>
                  <option value="ACTIVE">Active</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6 text-sm text-slate-600 dark:text-slate-400">
                <input
                  id={`verified-${user.id}`}
                  name="verified"
                  value="true"
                  type="checkbox"
                  className="h-4 w-4"
                  defaultChecked={Boolean(user.emailVerifiedAt)}
                />
                <label htmlFor={`verified-${user.id}`}>Email verified</label>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Admin note (optional)
              </p>
              <Input name="reason" placeholder="Reason for changes" />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Dialog.Close>
              <FormSubmitButton pendingText="Saving...">Save changes</FormSubmitButton>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
