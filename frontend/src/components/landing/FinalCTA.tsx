import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden">
      {/* Exact gradient background as specified */}
      <div
        className="py-16 md:py-24 lg:py-32"
        style={{
          background: 'linear-gradient(180deg, #4361EE 0%, #263788 100%)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Real profile avatars stack */}
            <div className="flex justify-center mb-8 lg:mb-12">
              <div className="flex items-center -space-x-3">
                {/* Avatar 1 - First (left) */}
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden bg-gray-700">
                  <img
                    src="/avatar1-cta.png"
                    alt="Developer 1"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                {/* Avatar 2 - Middle */}
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden relative z-10 bg-gray-600">
                  <img
                    src="/avatar2-cta.png"
                    alt="Developer 2"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                {/* Avatar 3 - Last (right) */}
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden bg-gray-700">
                  <img
                    src="/avatar3-cta.png"
                    alt="Developer 3"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Main headline with Manrope font */}
            <h2 className="font-manrope text-3xl md:text-4xl lg:text-4xl xl:text-5xl font-bold text-white mb-6 lg:mb-8 leading-tight lg:whitespace-nowrap">
              Ready to Build Your First Chatbot?
            </h2>

            {/* Subtitle with Manrope font */}
            <p className="font-manrope text-lg md:text-xl lg:text-xl xl:text-2xl text-white/90 mb-10 lg:mb-16 max-w-4xl mx-auto leading-relaxed lg:whitespace-nowrap">
              Join thousands of developers building the future of private AI.
            </p>

            {/* CTA Buttons with exact specifications */}
            <div className="space-y-4 lg:space-y-0 lg:flex lg:items-center lg:justify-center lg:gap-6">
              {/* Get started button - exact specs: width 125, height 44, border-radius 12px */}
              <Link to="/signup" className="block lg:inline-block">
                <Button
                  className="font-manrope w-full lg:w-[125px] h-[44px] bg-white hover:bg-gray-100 text-black font-semibold text-sm px-6 py-2 rounded-xl border-b-[3px] border-gray-300 hover:border-gray-400 transition-all duration-200 hover:scale-105 shadow-lg gap-1"
                >
                  Get started
                </Button>
              </Link>

              {/* Learn more button - exact specs: width 125, height 44, border-radius 12px */}
              <Link to="/about" className="block lg:inline-block">
                <Button
                  variant="outline"
                  className="font-manrope w-full lg:w-[125px] h-[44px] bg-gray-900/80 hover:bg-gray-800/90 text-white border-gray-700 hover:border-gray-600 font-semibold text-sm px-6 py-2 rounded-xl border-b-[3px] border-gray-800 hover:border-gray-700 transition-all duration-200 hover:scale-105 backdrop-blur-sm gap-1"
                >
                  Learn more
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}