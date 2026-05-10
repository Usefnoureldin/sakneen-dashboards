"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangeState } from "./actions";

const initial: ChangeState = {};

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Current password">
        <input
          type="password"
          name="currentPassword"
          required
          autoComplete="current-password"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sakneen-blue focus:outline-none focus:ring-2 focus:ring-sakneen-blue/30"
        />
      </Field>
      <Field label="New password" hint="At least 10 characters.">
        <input
          type="password"
          name="newPassword"
          minLength={10}
          maxLength={128}
          required
          autoComplete="new-password"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sakneen-blue focus:outline-none focus:ring-2 focus:ring-sakneen-blue/30"
        />
      </Field>
      <Field label="Confirm new password">
        <input
          type="password"
          name="confirmPassword"
          minLength={10}
          maxLength={128}
          required
          autoComplete="new-password"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sakneen-blue focus:outline-none focus:ring-2 focus:ring-sakneen-blue/30"
        />
      </Field>

      {state.error ? (
        <div
          role="alert"
          className="rounded-md border border-terracotta/30 bg-pill-rejected-bg px-3 py-2 text-sm text-pill-rejected-fg"
        >
          {state.error}
        </div>
      ) : null}

      {state.ok ? (
        <div className="rounded-md border border-status-approved/40 bg-pill-approved-bg px-3 py-2 text-sm text-pill-approved-fg">
          Password updated. The change takes effect next time you sign in.
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sakneen-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Updating..." : "Update password"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[2px] text-slate-500">{label}</span>
      {children}
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
