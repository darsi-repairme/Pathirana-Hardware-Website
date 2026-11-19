/** Simple chat-bubble-with-phone glyph used for WhatsApp actions. */
export function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.4c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z" />
    </svg>
  );
}

/**
 * Outline WhatsApp glyph (speech bubble + handset) drawn on the same 24px grid
 * and stroke as the lucide icons, so it matches the header Call icon in size
 * and weight. Stroke width comes from CSS / currentColor.
 */
export function WhatsAppOutlineIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M3.5 20.5 4.9 16.3A8.6 8.6 0 1 1 7.8 19.2Z" />
      <path
        stroke="none"
        fill="currentColor"
        d="M9.1 7.6c.3-.3.8-.3 1 .1l.9 1.6c.2.3.1.7-.1 1l-.5.5c.6 1.2 1.6 2.2 2.8 2.8l.5-.5c.3-.3.7-.3 1-.1l1.6.9c.4.2.4.7.1 1l-.6.6c-.6.6-1.5.8-2.3.5-2.2-.8-4-2.6-4.8-4.8-.3-.8-.1-1.7.5-2.3Z"
      />
    </svg>
  );
}
