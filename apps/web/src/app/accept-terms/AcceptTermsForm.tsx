"use client";
import { useState } from "react";

export function AcceptTermsForm() {
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleAccept() {
    if (!checked || pending) return;
    setPending(true);
    const res = await fetch("/api/auth/accept-terms", { method: "POST" });
    if (res.redirected) {
      window.location.href = res.url;
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#b61c28] focus:ring-[#b61c28] dark:border-slate-600"
        />
        <span className="text-sm text-slate-700 dark:text-slate-300 leading-snug">
          I have read and agree to the Terms of Service and Privacy Policy. I understand that
          UniSi is provided as-is and that electronic signatures may not be legally enforceable
          in all jurisdictions.
        </span>
      </label>

      <button
        type="button"
        onClick={handleAccept}
        disabled={!checked || pending}
        className="w-full inline-flex items-center justify-center min-h-11 rounded-lg bg-[#b61c28] text-white font-semibold text-sm hover:bg-[#9f1621] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {pending ? "Continuing…" : "Accept and continue"}
      </button>
    </div>
  );
}
