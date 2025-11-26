/**
 * Slider Component
 */

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number[]
  onValueChange: (value: number[]) => void
  max?: number
  min?: number
  step?: number
  disabled?: boolean
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, value, onValueChange, max = 100, min = 0, step = 1, disabled = false, ...props }, ref) => {
    const [isDragging, setIsDragging] = React.useState(false)
    const sliderRef = React.useRef<HTMLDivElement>(null)

    const currentValue = value[0] || 0
    const percentage = ((currentValue - min) / (max - min)) * 100

    const handlePointerDown = (event: React.PointerEvent) => {
      if (disabled) return
      setIsDragging(true)
      updateValue(event)
      ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: React.PointerEvent) => {
      if (!isDragging || disabled) return
      updateValue(event)
    }

    const handlePointerUp = () => {
      setIsDragging(false)
    }

    const updateValue = (event: React.PointerEvent) => {
      if (!sliderRef.current) return

      const rect = sliderRef.current.getBoundingClientRect()
      const position = (event.clientX - rect.left) / rect.width
      const newValue = Math.round((position * (max - min) + min) / step) * step
      const clampedValue = Math.max(min, Math.min(max, newValue))

      onValueChange([clampedValue])
    }

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        {...props}
      >
        <div
          ref={sliderRef}
          className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div
            className="absolute h-full bg-primary"
            style={{ width: `${percentage}%` }}
          />
          <div
            className={cn(
              "absolute h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "hover:bg-accent",
              isDragging && "scale-110",
              disabled && "pointer-events-none"
            )}
            style={{
              left: `calc(${percentage}% - 10px)`,
              top: '50%',
              transform: 'translateY(-50%)'
            }}
          />
        </div>
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }