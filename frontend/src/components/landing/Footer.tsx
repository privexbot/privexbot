import { Github, MessageCircle, Twitter } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUPPORT_EMAIL = "privexbot@gmail.com";
const GITHUB_URL = "https://github.com/privexbot/privexbot";
const DISCORD_URL = "https://discord.gg/53S3Ur9x";

export function Footer() {
  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder for newsletter signup
    console.log("Newsletter signup");
  };

  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-black dark:bg-black overflow-hidden">
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-12">
            {/* Company */}
            <div className="text-center md:text-left">
              <h3 className="text-white font-semibold text-base mb-6">Company</h3>
              <ul className="space-y-4">
                <li>
                  <Link to="/about" className="text-gray-400 hover:text-white text-sm transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link to="/faqs" className="text-gray-400 hover:text-white text-sm transition-colors">
                    FAQs
                  </Link>
                </li>
                <li>
                  <a
                    href="https://medium.com/@privexbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Blog
                  </a>
                </li>
                <li>
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>

            {/* Product */}
            <div className="text-center md:text-left">
              <h3 className="text-white font-semibold text-base mb-6">Product</h3>
              <ul className="space-y-4">
                <li>
                  <Link to="/pricing" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link to="/security" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Security
                  </Link>
                </li>
                <li>
                  <Link to="/data-compliance" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Data &amp; Compliance
                  </Link>
                </li>
                <li>
                  <Link to="/documentation" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Documentation
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div className="text-center md:text-left">
              <h3 className="text-white font-semibold text-base mb-6">Support</h3>
              <ul className="space-y-4">
                <li>
                  <Link to="/help" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Help Center
                  </Link>
                </li>
                <li>
                  <a
                    href={DISCORD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Discord community
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div className="text-center md:text-left">
              <h3 className="text-white font-semibold text-base mb-6">Legal</h3>
              <ul className="space-y-4">
                <li>
                  <Link to="/terms" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Terms of Use
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/cookies" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Cookie Policy
                  </Link>
                </li>
                <li>
                  <Link to="/acceptable-use" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Acceptable Use
                  </Link>
                </li>
              </ul>
            </div>

            {/* Subscribe + social — desktop */}
            <div className="hidden lg:block">
              <h3 className="text-white font-normal text-sm mb-4">
                Stay in the loop.
              </h3>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
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

              <div className="flex items-center gap-3 mt-10">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center text-white hover:border-gray-500 transition-colors"
                  aria-label="GitHub"
                >
                  <Github className="h-4 w-4" />
                </a>
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center text-white hover:border-gray-500 transition-colors"
                  aria-label="Discord"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
                <a
                  href="https://twitter.com/privexbot"
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

          {/* Mobile subscribe + social */}
          <div className="lg:hidden mt-12 text-center">
            <h3 className="text-white font-normal text-sm mb-6">Stay in the loop.</h3>
            <form onSubmit={handleNewsletterSubmit} className="space-y-4 max-w-sm mx-auto">
              <Input
                type="email"
                placeholder="Enter your email"
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

            <div className="flex items-center justify-center gap-4 mt-8">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center text-white hover:border-gray-500 transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center text-white hover:border-gray-500 transition-colors"
                aria-label="Discord"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com/privexbot"
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

        <div className="border-t border-gray-800 mx-4 lg:mx-0"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 text-center lg:text-left">
            <p className="text-gray-500 text-sm">
              © {year} PrivexBot · Apache 2.0 · privexbot.com
            </p>
            <div className="text-gray-500 text-sm flex flex-wrap justify-center lg:justify-end gap-x-3 gap-y-2">
              <Link to="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
              <span>·</span>
              <Link to="/privacy" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <span>·</span>
              <Link to="/cookies" className="hover:text-white transition-colors">
                Cookies
              </Link>
              <span>·</span>
              <Link to="/security" className="hover:text-white transition-colors">
                Security
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Background watermark */}
      <div className="relative pointer-events-none select-none mb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="text-[100px] sm:text-[140px] lg:text-[250px] xl:text-[300px] font-bold text-white/10 tracking-tighter text-center lg:text-left"
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              lineHeight: 0.85,
              letterSpacing: "-0.08em",
            }}
          >
            Privexbot
          </div>
        </div>
      </div>
    </footer>
  );
}
