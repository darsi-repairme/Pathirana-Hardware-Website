import type { Metadata } from "next";
import { business, mailHref, telHref } from "@/content/business";
import { createPageMetadata } from "@/lib/metadata";
import { LegalDraft, Tbc } from "@/components/legal/LegalDraft";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Privacy Policy",
    description: `Draft privacy policy for the ${business.legalName} website (awaiting owner review).`,
    path: "/privacy-policy/",
  }),
  // Draft — kept out of search results until approved.
  robots: { index: false, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDraft
      title="Privacy Policy"
      intro="How this website handles information. It describes only what the website does today."
      sections={[
        {
          id: "operator",
          heading: "Who runs this website",
          body: (
            <p>
              {business.legalName}, {business.address.street}, {business.address.locality}, {business.address.country}.
              Contact: <a href={telHref}>{business.phone.display}</a> or <a href={mailHref}>{business.email}</a>.
            </p>
          ),
        },
        {
          id: "information",
          heading: "Information you give us",
          body: (
            <>
              <p>
                The website has no forms, user accounts, online ordering or payments. We only receive personal
                information if you contact us yourself — by phone, WhatsApp or email — and then only what you choose to
                share, such as your name, phone number and message.
              </p>
              <p>We use it to answer your enquiry about products and services.</p>
            </>
          ),
        },
        {
          id: "third-parties",
          heading: "WhatsApp and other third-party services",
          body: (
            <p>
              WhatsApp links open WhatsApp; map links open Google Maps; social links open Facebook, Instagram, LinkedIn
              or TikTok. These services are run by third parties under their own privacy policies.
            </p>
          ),
        },
        {
          id: "cookies",
          heading: "Cookies and analytics",
          body: (
            <>
              <p>
                The website does not set cookies and does not use analytics, advertising or tracking tools. It saves one
                small setting in your browser&apos;s session storage so the opening animation plays only once per
                browser tab; it is deleted when you close the tab.
              </p>
              <p>
                <Tbc>
                  the hosting provider and any server logs it keeps (for example IP addresses and pages requested).
                </Tbc>
              </p>
            </>
          ),
        },
        {
          id: "retention",
          heading: "Keeping and accessing your information",
          body: (
            <>
              <p>
                <Tbc>how long enquiry messages and call details are kept, and who at the store can access them.</Tbc>
              </p>
              <p>
                To ask what information we hold about you, or to have it corrected or deleted, contact us at{" "}
                <a href={mailHref}>{business.email}</a> or <a href={telHref}>{business.phone.display}</a>.
              </p>
            </>
          ),
        },
        {
          id: "security",
          heading: "Security",
          body: (
            <p>
              <Tbc>the security measures in place for the website hosting and for stored enquiries.</Tbc>
            </p>
          ),
        },
        {
          id: "updates",
          heading: "Changes to this policy",
          body: (
            <p>
              We may update this policy; the current version will always be on this page.{" "}
              <Tbc>effective date once approved.</Tbc>
            </p>
          ),
        },
      ]}
    />
  );
}
