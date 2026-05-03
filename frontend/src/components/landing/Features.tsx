import { useState, useEffect } from "react";

interface Feature {
  id: number;
  title: string;
  image: string;
}

const features: Feature[] = [
  {
    id: 1,
    title: "Visual workflow builder",
    image: "/chatflow-canvas.png"
  },
  {
    id: 2,
    title: "Real-time analytics dashboard",
    image: "/dashboard-feature.png"
  },
  {
    id: 3,
    title: "Smart knowledge base creation",
    image: "/create-knowledge-base.png"
  },
  {
    id: 4,
    title: "Advanced KB management",
    image: "/KB-overview.png"
  }
];

export function Features() {
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-cycle through features continuously
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prevIndex) => (prevIndex + 1) % features.length);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const handleFeatureClick = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <section className="py-16 md:py-24 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 lg:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-2 font-manrope">
            Everything you need to ship
          </h2>
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6 font-manrope">
            a production AI agent
          </h3>
          <p className="max-w-2xl text-base md:text-lg text-gray-600 dark:text-gray-400 font-manrope">
            From the visual builder to the analytics dashboard, every surface
            is built around the same multi-tenant, privacy-first foundation.
          </p>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:flex lg:gap-16">
          {/* Left side - Feature texts with indicators */}
          <div className="flex-1 relative overflow-hidden" style={{ height: '500px' }}>
            {/* Static indicator - positioned exactly at text center line */}
            <div
              className="absolute left-0 w-1 h-8 rounded-full bg-gray-900 dark:bg-white z-10"
              style={{ top: '96px', transform: 'translateY(-50%)' }}
            />

            {/* Text container that slides continuously upward with infinite loop */}
            <div
              className="transition-transform duration-700 ease-in-out"
              style={{
                transform: `translateY(${64 - (activeIndex % features.length) * 64}px)`
              }}
            >
              {/* Create infinite loop by duplicating features */}
              {[...features, ...features].map((feature, index) => {
                const actualIndex = index % features.length;
                return (
                  <div
                    key={`${feature.id}-${index}`}
                    onClick={() => handleFeatureClick(actualIndex)}
                    className="cursor-pointer group"
                    style={{
                      height: '64px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {/* Feature text - only visible when at or below indicator line */}
                    <h3
                      className={`pl-6 text-xl lg:text-2xl font-medium font-manrope transition-all duration-500 ${
                        actualIndex === activeIndex && index === activeIndex
                          ? 'text-gray-900 dark:text-white translate-x-2 opacity-100'
                          : index > activeIndex && index <= activeIndex + features.length && actualIndex !== activeIndex
                          ? 'text-gray-600 dark:text-gray-400 opacity-50 hover:opacity-70'
                          : 'text-gray-600 dark:text-gray-400 opacity-0'
                      }`}
                    >
                      {feature.title}
                    </h3>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right side - Images with side indicators */}
          <div className="flex-1 flex gap-6">
            {/* Image container */}
            <div className="flex-1">
              <div className="relative overflow-hidden rounded-2xl shadow-2xl bg-gray-100 dark:bg-gray-800" style={{ height: '500px' }}>
                {/* All images stacked, only active one visible */}
                {features.map((feature, index) => (
                  <div
                    key={feature.id}
                    className={`absolute inset-0 transition-all duration-700 ${
                      index === activeIndex
                        ? 'opacity-100 translate-y-0'
                        : index < activeIndex
                        ? 'opacity-0 -translate-y-full'
                        : 'opacity-0 translate-y-full'
                    }`}
                  >
                    <img
                      src={feature.image}
                      alt={feature.title}
                      className="w-full h-full object-contain p-8"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Side progress indicators */}
            <div className="flex flex-col justify-center space-y-4">
              {features.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleFeatureClick(index)}
                  className={`transition-all duration-300 rounded-full ${
                    index === activeIndex
                      ? 'w-3 h-8 bg-gray-900 dark:bg-white'
                      : 'w-3 h-3 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden">
          {/* Mobile image carousel */}
          <div className="relative overflow-hidden rounded-2xl shadow-2xl bg-gray-100 dark:bg-gray-800 mb-8" style={{ height: '400px' }}>
            {features.map((feature, index) => (
              <div
                key={feature.id}
                className={`absolute inset-0 transition-all duration-700 ${
                  index === activeIndex
                    ? 'opacity-100 translate-y-0'
                    : index < activeIndex
                    ? 'opacity-0 -translate-y-full'
                    : 'opacity-0 translate-y-full'
                }`}
              >
                <img
                  src={feature.image}
                  alt={feature.title}
                  className="w-full h-full object-contain p-4"
                />
              </div>
            ))}
          </div>

          {/* Mobile feature texts */}
          <div className="relative overflow-hidden" style={{ height: '240px' }}>
            {/* Static indicator - positioned exactly at text center line */}
            <div
              className="absolute left-0 w-1 h-6 rounded-full bg-gray-900 dark:bg-white z-10"
              style={{ top: '90px', transform: 'translateY(-50%)' }}
            />

            {/* Text container that slides continuously upward with infinite loop */}
            <div
              className="transition-transform duration-700 ease-in-out"
              style={{
                transform: `translateY(${60 - (activeIndex % features.length) * 60}px)`
              }}
            >
              {/* Create infinite loop by duplicating features */}
              {[...features, ...features].map((feature, index) => {
                const actualIndex = index % features.length;
                return (
                  <div
                    key={`${feature.id}-${index}`}
                    onClick={() => handleFeatureClick(actualIndex)}
                    className="cursor-pointer"
                    style={{
                      height: '60px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {/* Feature text - only visible when at or below indicator line */}
                    <h3 className={`pl-4 text-lg font-medium font-manrope transition-all duration-500 ${
                      actualIndex === activeIndex && index === activeIndex
                        ? 'text-gray-900 dark:text-white translate-x-1 opacity-100'
                        : index > activeIndex && index <= activeIndex + features.length && actualIndex !== activeIndex
                        ? 'text-gray-600 dark:text-gray-400 opacity-50 hover:opacity-70'
                        : 'text-gray-600 dark:text-gray-400 opacity-0'
                    }`}>
                      {feature.title}
                    </h3>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile bottom dots */}
          <div className="flex justify-center mt-6 space-x-2">
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => handleFeatureClick(index)}
                className={`transition-all duration-300 ${
                  index === activeIndex
                    ? 'w-6 h-1.5 rounded-full bg-gray-900 dark:bg-white'
                    : 'w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}