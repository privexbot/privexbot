import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Testimonial {
  id: number;
  quote: string;
  author: string;
  title: string;
  company: string;
  avatar: string;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    quote:
      "We needed a way to ship a knowledge-base bot without sending customer documents to a third-party LLM. PrivexBot's TEE-backed inference was exactly the missing piece.",
    author: "Early access pilot",
    title: "Solo founder",
    company: "B2B SaaS",
    avatar: "/testimonial-image0.png",
  },
  {
    id: 2,
    quote:
      "Spinning up a chatflow with a Calendly node, a KB lookup, and a Discord deploy took an afternoon. The visual builder is the closest thing I've used to n8n for AI agents.",
    author: "Community contributor",
    title: "Backend engineer",
    company: "Open source community",
    avatar: "/testimonial-image1.jpg",
  },
  {
    id: 3,
    quote:
      "The fact that the whole platform is Apache-licensed and self-hostable is what got us through procurement. We can audit the code that handles our data.",
    author: "Open source user",
    title: "Engineering manager",
    company: "Self-hosted deployment",
    avatar: "/testimonial-image2.png",
  },
  {
    id: 4,
    quote:
      "Migrating from a spreadsheet of FAQs to a chatbot with citations took less than a day. The chunking strategies actually matter — the answers come back grounded.",
    author: "Pilot customer",
    title: "Operations lead",
    company: "Education non-profit",
    avatar: "/testimonial-image3.png",
  },
  {
    id: 5,
    quote:
      "I shipped a Telegram support bot in one sitting and added a website widget the next day. Same agent, two channels, zero glue code.",
    author: "Beta user",
    title: "Indie maker",
    company: "Side project",
    avatar: "/testimonial-image4.jpg",
  },
];

export function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);

  // Auto-scroll functionality
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => prevIndex + 1);
    }, 4000); // Change every 4 seconds

    return () => clearInterval(interval);
  }, []);

  // Handle infinite loop - reset to beginning when we reach the end
  useEffect(() => {
    if (currentIndex === testimonials.length) {
      setTimeout(() => {
        setIsTransitioning(false);
        setCurrentIndex(0);
        setTimeout(() => setIsTransitioning(true), 50);
      }, 700); // Wait for transition to complete
    }
  }, [currentIndex]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    if (currentIndex === 0) {
      setCurrentIndex(testimonials.length - 1);
    } else {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    setCurrentIndex(currentIndex + 1);
  };

  return (
    <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 lg:mb-16">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-manrope">Testimonials</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 font-manrope">
            What early users tell us
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto font-manrope">
            Selected feedback from early-access pilots, open-source
            contributors, and self-hosted deployments. Names withheld until we
            ship publicly named case studies.
          </p>
        </div>

        {/* Desktop: Horizontal scroll carousel */}
        <div className="hidden lg:block relative">
          <div className="overflow-hidden">
            <div
              className={`flex ${isTransitioning ? 'transition-transform duration-700 ease-in-out' : ''}`}
              style={{ transform: `translateX(-${currentIndex * (100 / 3)}%)` }}
            >
              {/* Duplicate first few items at the end for infinite loop effect */}
              {[...testimonials, ...testimonials.slice(0, 3)].map((testimonial, index) => (
                <div key={`${testimonial.id}-${index}`} className="w-1/3 flex-shrink-0 px-4">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col" style={{ height: '320px' }}>
                    <blockquote className="text-gray-900 dark:text-white text-lg leading-relaxed flex-1 mb-8 font-manrope overflow-hidden">
                      "{testimonial.quote}"
                    </blockquote>

                    <div className="flex items-center mt-auto">
                      <img
                        src={testimonial.avatar}
                        alt={testimonial.author}
                        className="w-12 h-12 rounded-full mr-4 object-cover flex-shrink-0"
                      />
                      <div>
                        <div className="text-gray-900 dark:text-white font-semibold font-manrope">
                          {testimonial.author}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 text-sm font-manrope">
                          {testimonial.title}, {testimonial.company}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation buttons */}
          <button
            onClick={goToPrevious}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-12 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-12 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Dots indicator */}
          <div className="flex justify-center mt-8 space-x-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentIndex % testimonials.length
                    ? "bg-gray-900 dark:bg-white scale-110"
                    : "bg-gray-400 dark:bg-gray-500 hover:bg-gray-500 dark:hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Mobile: Single card view with smooth transitions */}
        <div className="lg:hidden">
          <div className="space-y-6">
            {/* Fixed height container for smooth transitions */}
            <div className="relative overflow-hidden" style={{ height: '280px' }}>
              <div
                className={`flex ${isTransitioning ? 'transition-transform duration-700 ease-in-out' : ''}`}
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {/* Duplicate testimonials for infinite loop on mobile too */}
                {[...testimonials, ...testimonials.slice(0, 2)].map((testimonial, index) => (
                  <div key={`mobile-${testimonial.id}-${index}`} className="w-full flex-shrink-0">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-full">
                      <blockquote className="text-gray-900 dark:text-white text-lg leading-relaxed flex-1 mb-6 font-manrope overflow-hidden">
                        "{testimonial.quote}"
                      </blockquote>

                      <div className="flex items-center mt-auto">
                        <img
                          src={testimonial.avatar}
                          alt={testimonial.author}
                          className="w-12 h-12 rounded-full mr-4 object-cover flex-shrink-0"
                        />
                        <div>
                          <div className="text-gray-900 dark:text-white font-semibold font-manrope">
                            {testimonial.author}
                          </div>
                          <div className="text-gray-600 dark:text-gray-400 text-sm font-manrope">
                            {testimonial.title}, {testimonial.company}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile dots indicator */}
            <div className="flex justify-center space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentIndex % testimonials.length
                      ? "bg-gray-900 dark:bg-white scale-110"
                      : "bg-gray-400 dark:bg-gray-500 hover:bg-gray-500 dark:hover:bg-gray-400"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}