"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { useRef } from "react";
import {
  adminCompleteOnboardingAction,
  adminDeleteUserAction,
  adminForcePasswordResetAction,
  adminGeneratePasswordResetLinkAction,
  adminGenerateVerificationLinkAction,
  adminMarkEmailVerifiedAction,
  adminResendVerificationAction,
  adminUpdateUserRoleAction,
  adminUpdateUserStatusAction
} from "@/app/lib/actions/admin-user-actions";
import { EditUserModal } from "@/app/components/admin/edit-user-modal";

type UserRowMenuProps = {
  userId: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: "USER" | "ADMIN";
  emailVerifiedAt: Date | null;
  status: "PENDING" | "ACTIVE" | "DISABLED";
  deletedAt: Date | null;
};

type ActionFormProps = {
  action: (formData: FormData) => Promise<void>;
  userId: string;
  label: string;
  reasonPrompt?: string;
  confirmMessage?: string;
  extraFields?: Record<string, string>;
  danger?: boolean;
};

function ActionForm({
  action,
  userId,
  label,
  reasonPrompt,
  confirmMessage,
  extraFields,
  danger
}: ActionFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);

  const onClick = () => {
    let reason = "";
    if (reasonPrompt) {
      const input = window.prompt(reasonPrompt);
      if (!input) return;
      reason = input;
    }
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    if (reasonRef.current) {
      reasonRef.current.value = reason;
    }
    formRef.current?.requestSubmit();
  };

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="reason" ref={reasonRef} />
      {extraFields
        ? Object.entries(extraFields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))
        : null}
      <DropdownMenu.Item asChild>
        <button
          type="button"
          onClick={onClick}
          className={[
            "block w-full cursor-pointer px-3 py-2 text-left text-sm outline-none transition",
            danger
              ? "text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
              : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
          ].join(" ")}
        >
          {label}
        </button>
      </DropdownMenu.Item>
    </form>
  );
}

export function UserRowMenu({
  userId,
  email,
  name,
  phone,
  role,
  emailVerifiedAt,
  status,
  deletedAt
}: UserRowMenuProps) {
  const isVerified = Boolean(emailVerifiedAt);
  const isDeleted = Boolean(deletedAt);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:focus-visible:ring-offset-slate-950"
          aria-label="Open user menu"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[12rem] rounded-md border border-slate-200 bg-white py-2 text-sm text-slate-900 shadow-lg dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          align="end"
          sideOffset={8}
          collisionPadding={12}
        >
          <DropdownMenu.Item asChild>
            <Link
              href={`/admin/users/${userId}`}
              className="block cursor-pointer px-3 py-2 outline-none transition hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              View details
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <EditUserModal
              user={{
                id: userId,
                email,
                name,
                phone,
                role,
                status,
                emailVerifiedAt
              }}
              triggerLabel="Edit profile"
              triggerClassName="block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 outline-none transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
            />
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-slate-200 dark:bg-slate-800" />

          {!isVerified ? (
            <ActionForm
              action={adminMarkEmailVerifiedAction}
              userId={userId}
              label="Mark email verified"
              reasonPrompt="Reason for manual verification"
            />
          ) : null}
          {status !== "ACTIVE" ? (
            <ActionForm
              action={adminCompleteOnboardingAction}
              userId={userId}
              label="Complete onboarding"
              reasonPrompt="Reason for manual onboarding"
            />
          ) : null}
          {!isVerified ? (
            <ActionForm
              action={adminResendVerificationAction}
              userId={userId}
              label="Resend verification email"
            />
          ) : null}
          <ActionForm
            action={adminGenerateVerificationLinkAction}
            userId={userId}
            label="Generate verification link"
            reasonPrompt="Reason for manual link"
          />
          <ActionForm
            action={adminGeneratePasswordResetLinkAction}
            userId={userId}
            label="Generate reset link"
            reasonPrompt="Reason for manual link"
          />
          <ActionForm action={adminForcePasswordResetAction} userId={userId} label="Force password reset" />

          <DropdownMenu.Separator className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
          <ActionForm
            action={adminUpdateUserStatusAction}
            userId={userId}
            label="Set status: Active"
            extraFields={{ status: "ACTIVE" }}
          />
          <ActionForm
            action={adminUpdateUserStatusAction}
            userId={userId}
            label="Set status: Pending"
            extraFields={{ status: "PENDING" }}
          />
          <ActionForm
            action={adminUpdateUserStatusAction}
            userId={userId}
            label={isDeleted ? "Re-enable user" : "Disable user"}
            reasonPrompt="Reason for disabling"
            extraFields={{ status: "DISABLED" }}
          />

          <DropdownMenu.Separator className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
          <ActionForm
            action={adminUpdateUserRoleAction}
            userId={userId}
            label="Set role: User"
            extraFields={{ role: "USER" }}
          />
          <ActionForm
            action={adminUpdateUserRoleAction}
            userId={userId}
            label="Set role: Admin"
            extraFields={{ role: "ADMIN" }}
          />

          <DropdownMenu.Separator className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
          <ActionForm
            action={adminDeleteUserAction}
            userId={userId}
            label="Delete (soft)"
            reasonPrompt="Reason for deletion"
            confirmMessage="Disable and soft-delete this user?"
            danger
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
