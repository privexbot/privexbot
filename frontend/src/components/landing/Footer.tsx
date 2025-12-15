import { Facebook, Instagram, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Footer() {
  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder for newsletter signup
    console.log("Newsletter signup");
  };

  return (
    <footer className="relative bg-black dark:bg-black overflow-hidden">
      {/* Main Footer Content */}
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          {/* Mobile: Single column layout, Desktop: 4 columns */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 lg:gap-12">
            {/* Company Section */}
            <div className="text-center lg:text-left">
              <h3 className="text-white font-semibold text-base mb-6">Company</h3>
              <ul className="space-y-4">
                <li>
                  <a
                    href="/about"
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="/faqs"
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    FAQs
                  </a>
                </li>
                <li>
                  <a
                    href="/blog"
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Blog
                  </a>
                </li>
              </ul>
            </div>

            {/* Product Section */}
            <div className="text-center lg:text-left">
              <h3 className="text-white font-semibold text-base mb-6">Product</h3>
              <ul className="space-y-4">
                <li>
                  <a
                    href="#features"
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="/pricing"
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    href="/documentation"
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Documentation
                  </a>
                </li>
              </ul>
            </div>

            {/* Support Section */}
            <div className="text-center lg:text-left">
              <h3 className="text-white font-semibold text-base mb-6">Support</h3>
              <ul className="space-y-4">
                <li>
                  <a
                    href="/help"
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Help Center
                  </a>
                </li>
                <li>
                  <span className="text-gray-400 text-sm block">
                    0700-Call-Hoppr
                  </span>
                </li>
                <li>
                  <span className="text-gray-400 text-sm block">
                    0700-2255-46777
                  </span>
                </li>
              </ul>
            </div>

            {/* Subscribe Section - Desktop only in 4th column */}
            <div className="hidden lg:block">
              <h3 className="text-white font-normal text-sm mb-4">Subscribe to stay in the loop.</h3>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter Your Email"
                  className="flex-1 bg-gray-900 border-gray-800 text-white placeholder:text-gray-500 focus:border-gray-700 focus:ring-0"
                  required
                />
                <Button
                  type="submit"
                  className="bg-white hover:bg-gray-100 text-black font-medium px-6"
                >
                  Subscribe
                </Button>
              </form>

              {/* Social Icons - Desktop position */}
              <div className="flex items-center gap-3 mt-16">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center text-white hover:border-gray-500 transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="h-4 w-4 fill-current" />
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center text-white hover:border-gray-500 transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center text-white hover:border-gray-500 transition-colors"
                  aria-label="Twitter"
                >
                  <Twitter className="h-4 w-4 fill-current" />
                </a>
              </div>
            </div>
          </div>

          {/* Mobile Subscribe Section */}
          <div className="lg:hidden mt-12 text-center">
            <h3 className="text-white font-normal text-sm mb-6">Subscribe to stay in the loop.</h3>
            <form onSubmit={handleNewsletterSubmit} className="space-y-4 max-w-sm mx-auto">
              <Input
                type="email"
                placeholder="Enter Your Email"
                className="w-full bg-gray-900 border-gray-800 text-white placeholder:text-gray-500 focus:border-gray-700 focus:ring-0 text-center"
                required
              />
              <Button
                type="submit"
                className="w-full bg-white hover:bg-gray-100 text-black font-medium py-3"
              >
                Subscribe
              </Button>
            </form>

            {/* Social Icons - Mobile position */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center text-white hover:border-gray-500 transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5 fill-current" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center text-white hover:border-gray-500 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center text-white hover:border-gray-500 transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5 fill-current" />
              </a>
            </div>
          </div>
        </div>

        {/* Divider - Full width on desktop, padded on mobile */}
        <div className="border-t border-gray-800 mx-4 lg:mx-0"></div>

        {/* Bottom Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Desktop: Side by side, Mobile: Stacked centered */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 text-center lg:text-left">
            <p className="text-gray-500 text-sm">
              ©All right reserved • Privexbot
            </p>
            <div className="text-gray-500 text-sm">
              <span>2025 Terms and condition</span>
              <span className="hidden lg:inline mx-2">|</span>
              <span className="block lg:inline mt-2 lg:mt-0">
                <a href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Background Watermark/Logo - Spans the width of copyright section on desktop */}
      <div className="relative pointer-events-none select-none mb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="text-[100px] sm:text-[140px] lg:text-[250px] xl:text-[300px] font-bold text-white/10 tracking-tighter text-center lg:text-left"
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              lineHeight: 0.85,
              letterSpacing: '-0.08em'
            }}
          >
            Privexbot
          </div>
        </div>
      </div>
    </footer>
  );
}