"use client";

import Link from "next/link";
import { useActionState } from "react";
import { inviteAdminAction, type InviteAdminState } from "../actions";

const initial: InviteAdminState = {};

export function InviteAdminForm() {
  const [state, action, pending] = useActionState(inviteAdminAction, initial);

  if (state.ok) {
    return (
      <div className="rounded-xl border border-status-approved bg-pill-approved-bg p-5 space-y-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-pill-approved-fg mb-1">
            Admin created
          </p>
          <h2 className="font-serif text-xl text-charcoal">{state.createdEmail}</h2>
          <p className="text-sm text-slate-700 mt-1">Added as a Sakneen admin.</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-slate-500 mb-1">
            {state.generated ? "Generated temporary password" : "Password set"}
          </p>
          <p className="font-mono text-lg text-charcoal select-all">{state.createdPassword}</p>
          <p className="text-xs text-slate-600 mt-2">
            Share this with the user out-of-band. It will not be shown again.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Link
            href="/admin/users"
            className="text-sm rounded-md border border-slate-200 bg-white px-4 py-2 text-charcoal hover:bg-slate-50"
          >
            Back to admins
          </Link>
          <Link
            href="/admin/users/new"
            className="text-sm rounded-md bg-sakneen-blue px-4 py-2 font-semibold text-white hover:opacity-90"
          >
            Invite another
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email">
        <input
          type="email"
          name="email"
          required
          autoComplete="off"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sakneen-blue focus:outline-none focus:ring-2 focus:ring-sakneen-blue/30"
        />
      </Field>
      <Field label="Name">
        <input
          type="text"
          name="name"
          required
          autoComplete="off"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sakneen-blue focus:outline-none focus:ring-2 focus:ring-sakneen-blue/30"
        />
      </Field>
      <Field
        label="Password (optional)"
        hint="Leave empty to auto-generate a temporary password we will show you on the next screen."
      >
        <input
          type="text"
          name="password"
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-sakneen-blue focus:outline-none focus:ring-2 focus:ring-sakneen-blue/30"
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

      <div className="flex justify-between items-center">
        <Link href="/admin/users" className="text-sm text-slate-600 hover:text-charcoal">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sakneen-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create admin"}
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
