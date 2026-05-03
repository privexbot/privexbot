import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { TrustedBrands } from "@/components/landing/TrustedBrands";
import { ValuePropositions } from "@/components/landing/ValuePropositions";
import { ProductOverview } from "@/components/landing/ProductOverview";
import { Features } from "@/components/landing/Features";
import { CaseStudies } from "@/components/landing/CaseStudies";
import { Pricing } from "@/components/landing/Pricing";
import { Testimonials } from "@/components/landing/Testimonials";
import { OurBlog } from "@/components/landing/OurBlog";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <TrustedBrands />
        <ValuePropositions />
        <ProductOverview />
        <Features />
        <CaseStudies />
        <Pricing />
        <Testimonials />
        <OurBlog />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
