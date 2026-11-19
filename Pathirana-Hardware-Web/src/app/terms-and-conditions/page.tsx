import type { Metadata } from "next";
import { business, mailHref, telHref } from "@/content/business";
import { createPageMetadata } from "@/lib/metadata";
import { LegalDraft, Tbc } from "@/components/legal/LegalDraft";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Terms and Conditions",
    description: `Draft terms of use for the ${business.legalName} website (awaiting owner review).`,
    path: "/terms-and-conditions/",
  }),
  // Draft — kept out of search results until approved.
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <LegalDraft
      title="Terms and Conditions"
      intro="Terms for using this website. It is an information website; there is no online shopping."
      sections={[
        {
          id: "about",
          heading: "About this website",
          body: (
            <p>
              This website gives information about {business.legalName}, its products and its services. It has no online
              ordering, checkout or payments.
            </p>
          ),
        },
        {
          id: "information",
          heading: "Product and service information",
          body: (
            <p>
              The website does not show prices, stock levels or delivery terms. Please confirm prices, availability and
              any delivery arrangements with the store before you buy.
            </p>
          ),
        },
        {
          id: "links",
          heading: "Links to other services",
          body: (
            <p>
              Links to WhatsApp, Google Maps and social media open services run by third parties, under their own terms.
            </p>
          ),
        },
        {
          id: "content",
          heading: "Website content",
          body: (
            <p>
              <Tbc>ownership and permitted use of the website&apos;s text, images and design.</Tbc>
            </p>
          ),
        },
        {
          id: "law",
          heading: "Liability and governing law",
          body: (
            <p>
              <Tbc>limitation of liability and governing-law wording, to be provided by a legal adviser.</Tbc>
            </p>
          ),
        },
        {
          id: "contact",
          heading: "Contact",
          body: (
            <p>
              Questions about these terms: <a href={telHref}>{business.phone.display}</a> or{" "}
              <a href={mailHref}>{business.email}</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
