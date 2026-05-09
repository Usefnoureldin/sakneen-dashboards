"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[2px] text-slate-500">
          Email
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-charcoal focus:border-sakneen-blue focus:outline-none focus:ring-2 focus:ring-sakneen-blue/30"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[2px] text-slate-500">
          Password
        </span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-charcoal focus:border-sakneen-blue focus:outline-none focus:ring-2 focus:ring-sakneen-blue/30"
        />
      </label>

      {state.error ? (
        <div
          role="alert"
          className="rounded-md border border-terracotta/30 bg-pill-rejected-bg px-3 py-2 text-sm text-pill-rejected-fg"
        >
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-sakneen-blue px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>

      <a
        href="mailto:youssef@sakneen.com"
        className="mt-1 text-center font-mono text-[10px] uppercase tracking-[1.5px] text-slate-500 hover:text-charcoal"
      >
        Forgot password?
      </a>
    </form>
  );
}
