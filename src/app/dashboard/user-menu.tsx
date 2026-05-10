"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  name: string;
  email: string;
  signOut: () => Promise<void>;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserMenu({ name, email, signOut }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flex items-center gap-3">
      {/* Desktop: email link + sign out button */}
      <Link
        href="/profile"
        className="hidden sm:inline text-xs text-slate-600 hover:text-charcoal"
      >
        {email}
      </Link>
      <form action={signOut} className="hidden sm:block">
        <button
          type="submit"
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-charcoal hover:bg-slate-50"
        >
          Sign out
        </button>
      </form>

      {/* Mobile: initials avatar with dropdown */}
      <div ref={rootRef} className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`Account menu for ${name}`}
          aria-expanded={open}
          className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-sakneen-blue text-white font-mono text-[11px] font-semibold tracking-wide hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sakneen-blue/40 focus:ring-offset-2"
        >
          {initials(name)}
        </button>
        {open ? (
          <div className="absolute right-0 top-full mt-2 z-40 min-w-[200px] rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100">
              <p className="text-sm font-semibold text-charcoal truncate">{name}</p>
              <p className="text-xs text-slate-500 truncate">{email}</p>
            </div>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-charcoal hover:bg-slate-50"
            >
              Profile
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="w-full text-left px-3 py-2 text-sm text-charcoal hover:bg-slate-50 border-t border-slate-100"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
