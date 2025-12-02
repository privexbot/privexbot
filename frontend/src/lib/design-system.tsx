import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// Brand Icon Component with standardized styling
interface BrandIconProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function BrandIcon({ children, size = 'md', className }: BrandIconProps) {
  const containerClasses = {
    sm: 'icon-container-sm',
    md: 'icon-container',
    lg: 'icon-container-lg',
  };

  const iconClasses = {
    sm: 'brand-icon-sm',
    md: 'brand-icon',
    lg: 'brand-icon-lg',
  };

  return (
    <div className={cn(containerClasses[size], className)}>
      <div className={iconClasses[size]}>
        {children}
      </div>
    </div>
  );
}

// Brand Card Component
interface BrandCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
}

export function BrandCard({ children, className, padding = 'md', hover = true }: BrandCardProps) {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={cn(
        'brand-card',
        paddingClasses[padding],
        hover && 'hover:shadow-lg',
        className
      )}
    >
      {children}
    </div>
  );
}

// Brand Section with Grid Background
interface BrandSectionProps {
  children: React.ReactNode;
  className?: string;
  showGrid?: boolean;
  container?: 'default' | 'wide';
}

export function BrandSection({
  children,
  className,
  showGrid = true,
  container = 'default'
}: BrandSectionProps) {
  const containerClass = container === 'wide' ? 'brand-container-wide' : 'brand-container';

  return (
    <section className={cn('brand-section', className)}>
      {showGrid && <div className="brand-grid-bg" />}
      <div className={cn(containerClass, 'relative z-10')}>
        {children}
      </div>
    </section>
  );
}

// Brand Heading Components
interface BrandHeadingProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
}

export function BrandHeadingXL({ children, className, as: Component = 'h1' }: BrandHeadingProps) {
  return (
    <Component className={cn('brand-heading-xl', className)}>
      {children}
    </Component>
  );
}

export function BrandHeadingLG({ children, className, as: Component = 'h2' }: BrandHeadingProps) {
  return (
    <Component className={cn('brand-heading-lg', className)}>
      {children}
    </Component>
  );
}

export function BrandHeadingMD({ children, className, as: Component = 'h3' }: BrandHeadingProps) {
  return (
    <Component className={cn('brand-heading-md', className)}>
      {children}
    </Component>
  );
}

// Brand Text Components
interface BrandTextProps {
  children: React.ReactNode;
  className?: string;
}

export function BrandTextLG({ children, className }: BrandTextProps) {
  return (
    <p className={cn('brand-text-lg', className)}>
      {children}
    </p>
  );
}

export function BrandText({ children, className }: BrandTextProps) {
  return (
    <p className={cn('brand-text', className)}>
      {children}
    </p>
  );
}

// Animated Components with Brand Styling
interface AnimatedBrandCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  padding?: 'sm' | 'md' | 'lg';
}

export function AnimatedBrandCard({
  children,
  className,
  delay = 0,
  padding = 'md'
}: AnimatedBrandCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay, duration: 0.6 }}
    >
      <BrandCard className={className} padding={padding}>
        {children}
      </BrandCard>
    </motion.div>
  );
}

// Hero Section with Brand Styling
interface BrandHeroProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function BrandHero({ title, subtitle, className }: BrandHeroProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={cn('text-center', className)}
    >
      <BrandHeadingXL className="mb-6">
        {title}
      </BrandHeadingXL>
      {subtitle && (
        <BrandTextLG className="max-w-3xl mx-auto">
          {subtitle}
        </BrandTextLG>
      )}
    </motion.div>
  );
}

// Feature Card with Icon
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
  delay?: number;
}

export function FeatureCard({ icon, title, description, className, delay = 0 }: FeatureCardProps) {
  return (
    <AnimatedBrandCard className={className} delay={delay}>
      <BrandIcon className="mb-4">
        {icon}
      </BrandIcon>
      <BrandHeadingMD as="h3" className="mb-3">
        {title}
      </BrandHeadingMD>
      <BrandText>
        {description}
      </BrandText>
    </AnimatedBrandCard>
  );
}

// FAQ Item Component
interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  delay?: number;
}

export function FAQItem({ question, answer, isOpen, onToggle, delay = 0 }: FAQItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay, duration: 0.6 }}
      className="brand-card"
    >
      <button
        onClick={onToggle}
        className="w-full px-6 py-6 md:px-8 md:py-8 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-2xl flex items-center justify-between"
      >
        <span className="font-medium pr-4 text-brand-primary font-manrope">{question}</span>
        <svg
          className={`w-5 h-5 md:w-6 md:h-6 text-brand-secondary transform transition-transform duration-300 flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="px-6 pb-6 md:px-8 md:pb-8 pt-0">
          <BrandText className="leading-relaxed">
            {answer}
          </BrandText>
        </div>
      )}
    </motion.div>
  );
}

// Navigation Link Card
interface NavCardProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
}

export function NavCard({ to, icon, title, description, delay = 0 }: NavCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: delay > 0.5 ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.6 }}
    >
      <a
        href={to}
        className="brand-card p-4 hover:shadow-md transition-shadow group text-left block"
      >
        <div className="flex items-center space-x-3">
          <BrandIcon size="sm">
            {icon}
          </BrandIcon>
          <div>
            <h3 className="font-semibold font-manrope text-brand-primary">{title}</h3>
            <p className="text-sm font-manrope text-brand-secondary">{description}</p>
          </div>
        </div>
      </a>
    </motion.div>
  );
}

// Export utility classes for direct use
export const brandClasses = {
  container: 'brand-container',
  containerWide: 'brand-container-wide',
  card: 'brand-card',
  section: 'brand-section',
  gridBg: 'brand-grid-bg',
  headingXL: 'brand-heading-xl',
  headingLG: 'brand-heading-lg',
  headingMD: 'brand-heading-md',
  textLG: 'brand-text-lg',
  text: 'brand-text',
  textPrimary: 'text-brand-primary',
  textSecondary: 'text-brand-secondary',
  icon: 'brand-icon',
  iconContainer: 'icon-container',
} as const;