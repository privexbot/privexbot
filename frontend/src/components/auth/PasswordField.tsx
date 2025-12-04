/**
 * PasswordField Component
 *
 * Enhanced password input with strength validation,
 * visibility toggle, and security indicators.
 */

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordStrength {
  score: number; // 0-4
  feedback: string[];
  isValid: boolean;
}

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  showStrength?: boolean;
  minLength?: number;
  className?: string;
  error?: string;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = "••••••••",
  required = false,
  disabled = false,
  showStrength = false,
  minLength = 8,
  className,
  error,
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  const strength = analyzePasswordStrength(value, minLength);

  const getStrengthColor = (score: number): string => {
    switch (score) {
      case 0:
        return "text-gray-500";
      case 1:
        return "text-red-500";
      case 2:
        return "text-orange-500";
      case 3:
        return "text-yellow-500";
      case 4:
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  const getStrengthText = (score: number): string => {
    switch (score) {
      case 0:
        return "";
      case 1:
        return "Very Weak";
      case 2:
        return "Weak";
      case 3:
        return "Fair";
      case 4:
        return "Strong";
      default:
        return "";
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          disabled={disabled}
          className={cn(
            "pr-10",
            error && "border-red-500 focus-visible:ring-red-500",
            strength.isValid && value.length > 0 && "border-green-500"
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Password strength indicator */}
      {showStrength && value.length > 0 && !error && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {strength.isValid ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Info className="h-4 w-4 text-muted-foreground" />
            )}
            <span className={cn("text-sm font-medium", getStrengthColor(strength.score))}>
              {getStrengthText(strength.score)}
            </span>
          </div>

          {/* Strength bar */}
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={cn(
                  "h-1 rounded-full flex-1 transition-colors",
                  level <= strength.score
                    ? strength.score === 1
                      ? "bg-red-500"
                      : strength.score === 2
                      ? "bg-orange-500"
                      : strength.score === 3
                      ? "bg-yellow-500"
                      : "bg-green-500"
                    : "bg-gray-200 dark:bg-gray-700"
                )}
              />
            ))}
          </div>

          {/* Feedback */}
          {strength.feedback.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-1">
              {strength.feedback.map((feedback, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-current rounded-full" />
                  {feedback}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Analyze password strength and provide feedback
 */
function analyzePasswordStrength(password: string, minLength: number): PasswordStrength {
  if (password.length === 0) {
    return { score: 0, feedback: [], isValid: false };
  }

  let score = 0;
  const feedback: string[] = [];

  // Length check
  if (password.length >= minLength) {
    score += 1;
  } else {
    feedback.push(`Must be at least ${minLength} characters long`);
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 0.5;
  } else {
    feedback.push("Include lowercase letters");
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 0.5;
  } else {
    feedback.push("Include uppercase letters");
  }

  // Numbers check
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push("Include numbers");
  }

  // Special characters check
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Include special characters");
  }

  // Bonus for length
  if (password.length >= 12) {
    score += 0.5;
  }

  // Round score and cap at 4
  score = Math.min(Math.round(score), 4);

  const isValid = password.length >= minLength && score >= 2;

  return { score, feedback, isValid };
}