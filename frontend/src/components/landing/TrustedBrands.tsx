import { motion } from "framer-motion";

const brands = [
  {
    name: "Secret Network",
    logo: "/secret-network-logo.png",
    alt: "Secret Network",
  },
  {
    name: "Shades",
    logo: "/shade-logo.png",
    alt: "Shades",
  },
];

export function TrustedBrands() {
  return (
    <section className="py-12 md:py-16 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-manrope font-medium">
            Built on Secret Network
          </p>
        </motion.div>

        {/* Brand Logos - Continuous Auto-Sliding Animation */}
        <div className="relative overflow-hidden">
          {/* Desktop: Horizontal infinite auto-sliding */}
          <div className="hidden md:block">
            <div className="flex items-center gap-16 lg:gap-20 xl:gap-24 animate-slide-infinite">
              {/* Triple the logos for seamless infinite loop */}
              {[...brands, ...brands, ...brands, ...brands, ...brands, ...brands].map((brand, index) => (
                <div
                  key={`${brand.name}-${String(index)}`}
                  className="flex items-center justify-center group flex-shrink-0"
                >
                  <img
                    src={brand.logo}
                    alt={brand.alt}
                    className="h-14 lg:h-16 xl:h-20 w-auto object-contain transition-all duration-300 group-hover:scale-110 filter-brand-logo"
                    style={{ maxWidth: "220px", minWidth: "120px" }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Tablet: 4 logos in single row */}
          <div className="hidden sm:block md:hidden">
            <div className="flex items-center justify-center gap-8">
              {brands.map((brand, index) => (
                <motion.div
                  key={brand.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: 0.15 * index,
                    duration: 0.6,
                    ease: "easeOut",
                  }}
                  className="flex items-center justify-center group"
                >
                  <img
                    src={brand.logo}
                    alt={brand.alt}
                    className="h-12 w-auto object-contain transition-all duration-300 group-hover:scale-105 filter-brand-logo"
                    style={{ maxWidth: "160px" }}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Mobile: Full-width continuous sliding */}
          <div className="sm:hidden relative -mx-4 overflow-hidden">
            <div className="flex items-center gap-8 animate-slide-mobile px-4">
              {/* Multiple copies for mobile infinite scroll */}
              {[...brands, ...brands, ...brands, ...brands, ...brands, ...brands].map((brand, index) => (
                <div
                  key={`mobile-${brand.name}-${String(index)}`}
                  className="flex items-center justify-center flex-shrink-0"
                >
                  <img
                    src={brand.logo}
                    alt={brand.alt}
                    className="h-10 w-auto object-contain filter-brand-logo"
                    style={{ maxWidth: "140px", minWidth: "80px" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CSS for continuous auto-sliding animation and optimized colors */}
        <style>{`
          .animate-slide-infinite {
            animation: slideInfinite 30s linear infinite;
            will-change: transform;
          }

          @keyframes slideInfinite {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-33.33%);
            }
          }

          .animate-slide-infinite:hover {
            animation-play-state: paused;
          }

          .animate-slide-mobile {
            animation: slideMobile 25s linear infinite;
            will-change: transform;
          }

          @keyframes slideMobile {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-33.33%);
            }
          }

          .filter-brand-logo {
            filter: grayscale(80%) brightness(0.5) contrast(1.5);
            transition: filter 0.3s ease;
          }

          .filter-brand-logo:hover {
            filter: grayscale(0%) brightness(1) contrast(1) saturate(1);
          }

          .dark .filter-brand-logo {
            filter: grayscale(80%) brightness(0.8) contrast(1.8) invert(1);
          }

          .dark .filter-brand-logo:hover {
            filter: grayscale(20%) brightness(1) contrast(1.2) saturate(1.1)
              invert(1);
          }

          @media (max-width: 640px) {
            .animate-slide-infinite {
              animation: none;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
