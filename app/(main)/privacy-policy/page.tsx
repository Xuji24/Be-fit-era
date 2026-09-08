import type { Metadata } from "next";
import PrivacyPolicyPage from "@/components/pages/main/legal/PrivacyPolicyPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Be Fit Era collects, uses, and protects your personal information.",
};

export default function PrivacyPolicy() {
  return <PrivacyPolicyPage />;
}
