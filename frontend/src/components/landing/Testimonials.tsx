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
    quote: "PrivexBot revolutionized our customer support. The privacy-first approach gives us confidence that our data stays secure while delivering exceptional AI responses.",
    author: "Alex Carter",
    title: "Product Designer",
    company: "TechFlow",
    avatar: "/testimonial-image0.png"
  },
  {
    id: 2,
    quote: "I've tried dozens of chatbot solutions—this is by far the most secure and versatile one yet. The Secret VM architecture gives us enterprise-grade privacy.",
    author: "Samantha Lee",
    title: "Product Designer",
    company: "SecureCore",
    avatar: "/testimonial-image1.jpg"
  },
  {
    id: 3,
    quote: "The RAG implementation is top-tier. Our knowledge base integration was seamless, and the multi-channel deployment saved us months of development.",
    author: "Jordan Kim",
    title: "Frontend Engineer",
    company: "DataVault",
    avatar: "/testimonial-image2.png"
  },
  {
    id: 4,
    quote: "It's rare to find a platform that perfectly balances powerful AI capabilities with uncompromising privacy. PrivexBot gets it right.",
    author: "Daniel White",
    title: "Head of Engineering",
    company: "PrivacyFirst",
    avatar: "/testimonial-image3.png"
  },
  {
    id: 5,
    quote: "The visual workflow builder made creating complex chatbots incredibly intuitive. Our team was productive from day one.",
    author: "Maya Rodriguez",
    title: "AI Product Manager",
    company: "InnovateAI",
    avatar: "/testimonial-image4.jpg"
  }
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
            Our customer reviews
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto font-manrope">
            See what designers and developers are saying about their experience with PrivexBot.
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