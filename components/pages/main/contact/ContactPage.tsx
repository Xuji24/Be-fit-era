"use client";

import ContactForm from "./component/contact-form";
import ContactInfo from "./component/contact-info";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <section className="relative bg-[#1A1A1A] dark:bg-[#0D0D0D] pt-28 pb-14 md:pt-32 md:pb-16">
        {/* Radial glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-100 bg-[#FF5733]/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-raleway text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
            We&apos;d Love to{" "}
            <span className="text-[#FFB800]">Hear From You</span>
          </h1>
          <p className="mt-3 text-white/50 text-sm md:text-base max-w-lg">
            Have a question, feedback, or want to partner with us? Drop us a
            message and we&apos;ll get back to you.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 py-12 sm:py-16 md:py-20">
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
