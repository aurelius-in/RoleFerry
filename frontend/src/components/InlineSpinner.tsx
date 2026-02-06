import React from "react";

export default function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white/80",
        className || "",
      ]
        .join(" ")
        .trim()}
    />
  );
}

