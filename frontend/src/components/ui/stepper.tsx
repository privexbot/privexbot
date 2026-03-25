/**
 * Multi-Step Stepper Component
 *
 * Provides visual navigation for multi-step workflows with progress indication
 */

import React from 'react';
import { Check, Circle, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  id: number;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface StepperProps {
  steps: Step[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick?: (stepId: number) => void;
  canNavigateToStep?: (stepId: number) => boolean;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  canNavigateToStep = () => true,
  className
}) => {
  const isStepCompleted = (stepId: number) => completedSteps.has(stepId);
  const isStepActive = (stepId: number) => stepId === currentStep;
  const isStepClickable = (stepId: number) => canNavigateToStep(stepId) && onStepClick;

  return (
    <div className={cn("w-full", className)}>
      <nav className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = isStepCompleted(step.id);
          const isActive = isStepActive(step.id);
          const isClickable = isStepClickable(step.id);
          const isLocked = !canNavigateToStep(step.id);

          return (
            <React.Fragment key={step.id}>
              {/* Step Circle */}
              <div className="flex flex-col items-center relative">
                <button
                  onClick={() => isClickable && onStepClick!(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    "relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200",
                    {
                      // Completed step
                      "bg-green-500 border-green-500 text-white": isCompleted,
                      // Active step
                      "bg-blue-500 border-blue-500 text-white": isActive && !isCompleted,
                      // Clickable step
                      "border-gray-300 bg-white text-gray-500 hover:border-blue-400 hover:text-blue-600":
                        isClickable && !isActive && !isCompleted && !isLocked,
                      // Locked step
                      "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed": isLocked,
                      // Default step
                      "border-gray-300 bg-white text-gray-400":
                        !isClickable && !isActive && !isCompleted && !isLocked
                    }
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : isLocked ? (
                    <Lock className="w-4 h-4" />
                  ) : step.icon ? (
                    <span className="w-5 h-5 flex items-center justify-center">
                      {step.icon}
                    </span>
                  ) : (
                    <Circle className="w-3 h-3 fill-current" />
                  )}
                </button>

                {/* Step Label */}
                <div className="mt-2 text-center">
                  <div className={cn(
                    "text-xs font-medium transition-colors",
                    {
                      "text-green-600": isCompleted,
                      "text-blue-600": isActive,
                      "text-gray-900": !isActive && !isCompleted && !isLocked,
                      "text-gray-400": isLocked
                    }
                  )}>
                    {step.title}
                  </div>
                  {step.description && (
                    <div className="text-xs text-gray-500 mt-1 max-w-24 leading-tight">
                      {step.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-4">
                  <div className={cn(
                    "h-0.5 transition-colors",
                    {
                      "bg-green-500": isCompleted,
                      "bg-blue-500": isActive,
                      "bg-gray-300": !isCompleted && !isActive
                    }
                  )} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );
};

export default Stepper;