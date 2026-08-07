"use client";

import ContactForm from "./component/contact-form";
import ContactInfo from "./component/contact-info";
import PageHeader from "@/components/page-header";

export default function ContactPage() {
  return (
    <div className="min-h-screen relative">
      <PageHeader
        title="We'd Love to Hear From You"
        subtitle="Have a question, feedback, or want to partner with us? Drop us a message and we'll get back to you."
      />

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pb-12 sm:pb-16 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14">
          {/* Contact Form — takes more space */}
          <div className="lg:col-span-3">
            <ContactForm />
          </div>

          {/* Contact Info Sidebar */}
          <div className="lg:col-span-2">
            <ContactInfo />
          </div>
        </div>
      </div>
    </div>
  );
}
