import type { Metadata } from "next";
import { business, mailHref, telHref } from "@/content/business";
import { createPageMetadata } from "@/lib/metadata";
import { LegalDraft, Tbc } from "@/components/legal/LegalDraft";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Refund Policy",
    description: `Draft refund and returns policy for ${business.legalName} (awaiting owner review).`,
    path: "/refund-policy/",
  }),
  // Draft — kept out of search results until approved.
  robots: { index: false, follow: true },
};

export default function RefundPolicyPage() {
  return (
    <LegalDraft
      title="Refund Policy"
      intro="Returns and refunds for purchases from Pathirana Hardware. The store's terms are still being confirmed."
      sections={[
        {
          id: "online",
          heading: "Online purchases",
          body: (
            <p>
              This website does not sell products online, take payments or offer a checkout, so there are no online
              orders to refund.
            </p>
          ),
        },
        {
          id: "in-store",
          heading: "Purchases from the store",
          body: (
            <>
              <p>The store&apos;s returns and refund terms are awaiting confirmation from the owner:</p>
              <ul>
                <li>
                  <Tbc>whether returns, exchanges or refunds are accepted.</Tbc>
                </li>
                <li>
                  <Tbc>any time limit, and the condition items must be in.</Tbc>
                </li>
                <li>
                  <Tbc>the proof of purchase required.</Tbc>
                </li>
                <li>
                  <Tbc>how refunds are paid, and any items that cannot be returned.</Tbc>
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "contact",
          heading: "Questions about a purchase",
          body: (
            <p>
              Until this policy is approved, please contact the store about any purchase: call{" "}
              <a href={telHref}>{business.phone.display}</a> or email <a href={mailHref}>{business.email}</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
