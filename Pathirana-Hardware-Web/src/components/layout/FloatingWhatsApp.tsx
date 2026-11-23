import { whatsappChatHref } from "@/content/business";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { T, TRegion } from "@/i18n/I18nProvider";

/**
 * Floating WhatsApp button on every public page (bottom right, above the
 * phone's safe area). Opens the shop's official chat in a new tab; the
 * customer writes and sends the message themselves.
 */
export function FloatingWhatsApp() {
  return (
    <TRegion as="aside" label="Quick contact">
      <a
        href={whatsappChatHref}
        target="_blank"
        rel="noopener noreferrer"
        data-floating-whatsapp
        className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex size-14 items-center justify-center rounded-full bg-[#177a42] text-white shadow-[0_12px_28px_-10px_rgb(0_0_0/0.55)] ring-2 ring-white/70 transition-[transform,background-color] duration-300 hover:-translate-y-0.5 hover:bg-[#11653a] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gold-soft motion-reduce:transition-none motion-reduce:hover:translate-y-0 print:hidden"
      >
        <WhatsAppIcon className="size-7" />
        <span className="sr-only">
          <T>Chat with us on WhatsApp (opens in a new tab)</T>
        </span>
      </a>
    </TRegion>
  );
}
