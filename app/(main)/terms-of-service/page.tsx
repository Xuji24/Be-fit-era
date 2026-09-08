import type { Metadata } from "next";
import TermsOfServicePage from "@/components/pages/main/legal/TermsOfServicePage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Be Fit Era.",
};

export default function TermsOfService() {
  return <TermsOfServicePage />;
}
