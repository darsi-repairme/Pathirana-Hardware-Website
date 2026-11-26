import type { Metadata } from "next";
import { FEEDBACK_STATUSES } from "@/lib/api";
import { FeedbackManager } from "./FeedbackManager";

export const metadata: Metadata = { title: "Customer Feedback" };

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const s = (await searchParams).status ?? "";
  return <FeedbackManager initialStatus={(FEEDBACK_STATUSES as readonly string[]).includes(s) ? s : ""} />;
}
