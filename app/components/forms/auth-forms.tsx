"use client";

import { useFormState } from "react-dom";
import {
  loginFormAction,
  registerFormAction,
  forgotPasswordFormAction,
  resetPasswordFormAction,
  type AuthFormState
} from "@/app/lib/actions/auth-actions";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

const initialState: AuthFormState = {};

export function LoginForm() {
  const [state, formAction] = useFormState(loginFormAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {state.error}
        </div>
      )}
      <div>
        <label className="text-sm text-slate-300">Email</label>
        <Input name="email" type="email" required placeholder="you@example.com" />
      </div>
      <div>
        <label className="text-sm text-slate-300">Password</label>
        <Input name="password" type="password" required />
      </div>
      <Button className="w-full">Sign in</Button>
    </form>
  );
}

export function RegisterForm() {
  const [state, formAction] = useFormState(registerFormAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {state.error}
        </div>
      )}
      <div>
        <label className="text-sm text-slate-300">Full name</label>
        <Input name="name" required placeholder="Avery Pilot" />
      </div>
      <div>
        <label className="text-sm text-slate-300">Email</label>
        <Input name="email" type="email" required placeholder="you@example.com" />
      </div>
      <div>
        <label className="text-sm text-slate-300">Phone</label>
        <Input name="phone" type="tel" required placeholder="+1 (555) 555-5555" />
      </div>
      <div>
        <label className="text-sm text-slate-300">Password</label>
        <Input name="password" type="password" required minLength={10} />
      </div>
      <Button className="w-full">Request access</Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(forgotPasswordFormAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {(state.error || state.success) && (
        <div className="rounded-lg border border-brand-500/40 bg-brand-500/10 p-3 text-sm text-brand-200">
          {state.error ?? state.success}
        </div>
      )}
      <div>
        <label className="text-sm text-slate-300">Email</label>
        <Input name="email" type="email" required placeholder="you@example.com" />
      </div>
      <Button className="w-full">Send reset link</Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const [state, formAction] = useFormState(resetPasswordFormAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {(state.error || state.success) && (
        <div className="rounded-lg border border-brand-500/40 bg-brand-500/10 p-3 text-sm text-brand-200">
          {state.error ?? state.success}
        </div>
      )}
      <div>
        <label className="text-sm text-slate-300">Token</label>
        <Input name="token" defaultValue={token ?? ""} required />
      </div>
      <div>
        <label className="text-sm text-slate-300">New password</label>
        <Input name="password" type="password" required minLength={10} />
      </div>
      <Button className="w-full">Update password</Button>
    </form>
  );
}
