import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { motion } from "framer-motion";

const privacySections = [
  {
    title: "Introduction",
    content: `At PrivexBot Network, we acknowledge that you entrust us with information that belongs to you, and we take that seriously. This Privacy Policy describes how we collect, use, and disclose information, and what choices you have with respect to the information.

This Privacy Policy applies to the online data collection and use practices of our website https://privexbot.com and our software and services. We are committed to protecting your privacy.`
  },
  {
    title: "Acceptance of Terms",
    content: `By using PrivexBot Network you acknowledge that you have read this Privacy Policy and agree to be bound by it. This Privacy Policy may be updated periodically to reflect changes in our privacy practices. If you object to any of the changes, you may contact us.

Changes to our Privacy Policy are effective when they are posted on this page. Your continued use of our website, software and services after any such changes constitutes your acceptance of the new Privacy Policy.`
  },
  {
    title: "Changes to Terms",
    content: `PrivexBot Network may modify this Privacy Policy at any time. When we do, we will revise the updated date at the bottom of this page. We encourage users to frequently check this page for any changes to stay informed about how we are helping to protect the personal information we collect.

If we make material changes to this policy, we may also notify you by other means prior to the changes taking effect, such as by sending an email or posting a notice on our website.`
  },
  {
    title: "Privacy Policy",
    content: `We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, store, and protect your information when you use our services.

We collect information that you provide directly to us, such as when you create an account, use our services, or contact us. We also collect certain information automatically when you use our services.`
  },
  {
    title: "Use of Services",
    content: `By using PrivexBot Network, you acknowledge that you understand and agree to the information collection and use practices described in this Privacy Policy. You are responsible for reviewing this Privacy Policy periodically for any updates.

If you do not agree to any of the terms of this Privacy Policy, you should not use our website, software or services. Your continued use of our services constitutes your acceptance of this Privacy Policy and any updates.`
  },
  {
    title: "Use of Services",
    content: `Our services are designed to help you build and deploy AI chatbots with privacy-first architecture. When you use our services, we process your data in accordance with this Privacy Policy and applicable data protection laws.

We use industry-standard security measures to protect your information and employ Secret Network's Trusted Execution Environment (TEE) to ensure maximum privacy protection for your data.`
  },
  {
    title: "Use of Services",
    content: `We may collect and use your information for various purposes including to provide, maintain, and improve our services; to process transactions; to send you technical notices and support messages; and to respond to your comments and questions.

We will not sell, rent, or lease your personal information to third parties. We may share your information only as described in this Privacy Policy or with your consent.`
  },
  {
    title: "Use of Services",
    content: `You retain ownership of any content you submit to our services. We do not claim ownership of your content, but you grant us a limited license to use, store, and process your content solely for the purpose of providing our services.

Your data is processed in secure environments and is protected by industry-leading security measures including encryption at rest and in transit.`
  },
  {
    title: "Use of Services",
    content: `We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include internal reviews of our data collection, storage, and processing practices.

We regularly review our security practices and update them as needed to maintain the highest level of protection for your information.`
  },
  {
    title: "Use of Services",
    content: `You have certain rights regarding your personal information, including the right to access, update, or delete your information. You may also have the right to restrict or object to certain processing activities.

To exercise these rights or if you have questions about your personal information, please contact us using the information provided in the Contact section below.`
  },
  {
    title: "Use of Services",
    content: `We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law.

When we no longer need your personal information, we will securely delete or anonymize it in accordance with our data retention policies and applicable legal requirements.`
  },
  {
    title: "Use of Services",
    content: `Our services are built with privacy by design principles, utilizing Secret Network's privacy-preserving technology to ensure that your data remains confidential and secure throughout the processing lifecycle.

We are committed to transparency in our data practices and will notify you of any significant changes to how we handle your personal information.`
  },
  {
    title: "Contact Information",
    content: `If you have any questions about this Privacy Policy, please contact us at:

Email: privacy@privexbot.com
Website: https://privexbot.com

We will respond to all legitimate requests within a reasonable timeframe and will work with you to address any concerns you may have about our privacy practices.`
  }
];

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />

      <main>
        {/* Hero Section */}
        <section className="pt-24 pb-16 md:pt-32 md:pb-24 relative overflow-hidden">
          {/* Grid background pattern with diamond intersections */}
          <div
            className="absolute inset-0 opacity-30 dark:opacity-20"
            style={{
              backgroundImage: `
                radial-gradient(circle at 50% 50%, #d1d5db 2px, transparent 2px),
                linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px, 48px 48px, 48px 48px',
              backgroundPosition: '24px 24px, 0 0, 0 0'
            }}
          />

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 font-manrope">
                We care about your privacy
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto font-manrope">
                PrivexBot is built with privacy-first architecture using Secret Network's Trusted Execution Environment to ensure your data stays secure.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Privacy Policy Content */}
        <section className="pb-16 md:pb-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-12 md:space-y-16">
              {privacySections.map((section, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  className="relative"
                >
                  {/* Section Number */}
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      {/* Section Title */}
                      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4 font-manrope">
                        {section.title}
                      </h2>

                      {/* Section Content */}
                      <div className="prose prose-lg prose-gray dark:prose-invert max-w-none">
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-manrope whitespace-pre-line">
                          {section.content}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}