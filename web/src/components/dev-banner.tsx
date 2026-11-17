"use client";
import { CloudOff, FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { FIREBASE, onSyncError, resetDevData } from "@/lib/store/db";

/**
 * Honest status marker.
 *  • Local demo mode: a permanent banner — data lives only in this browser.
 *  • Firebase mode: nothing, unless a change could not be saved to the cloud.
 */
export function DevBanner() {
  const [confirming, setConfirming] = useState(false);
  const [syncError, setSyncError] = useState("");
  useEffect(() => onSyncError(setSyncError), []);

  if (FIREBASE) {
    if (!syncError) return null;
    return (
      <div role="alert" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-error-soft px-4 py-1.5 text-center text-xs text-on-error-soft">
        <span className="inline-flex items-center gap-1.5 font-semibold"><CloudOff className="size-3.5" aria-hidden /> Not saved</span>
        <span>{syncError} What you see has been reset to the saved version.</span>
        <button className="underline" onClick={() => setSyncError("")}>Dismiss</button>
      </div>
    );
  }
  return (
    <div role="note" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-warning-soft px-4 py-1.5 text-center text-xs text-on-warning-soft">
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <FlaskConical className="size-3.5" aria-hidden /> Local demo mode
      </span>
      <span>Data is saved only in this browser and includes labelled demonstration content. Add your Firebase keys to go live.</span>
      {confirming ? (
        <span className="inline-flex gap-2">
          <button className="font-semibold underline" onClick={() => { resetDevData(); setConfirming(false); }}>Yes, reset all demo data</button>
          <button className="underline" onClick={() => setConfirming(false)}>Cancel</button>
        </span>
      ) : (
        <button className="underline" onClick={() => setConfirming(true)}>Reset demo data</button>
      )}
    </div>
  );
}
