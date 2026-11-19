/** Simple Facebook "f" glyph (Lucide no longer ships brand icons). */
export function FacebookIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
      <path d="M14 8h3V4h-3c-2.76 0-5 2.24-5 5v2H6v4h3v9h4v-9h3l1-4h-4V9c0-.55.45-1 1-1z" />
    </svg>
  );
}
