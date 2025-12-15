/**
 * Radio Group Component
 */

import * as React from "react"
import { cn } from "@/lib/utils"

interface RadioGroupContextType {
  value: string
  onValueChange: (value: string) => void
  name?: string
}

const RadioGroupContext = React.createContext<RadioGroupContextType>({
  value: '',
  onValueChange: () => {}
})

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  onValueChange: (value: string) => void
  name?: string
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, name, children, ...props }, ref) => {
    return (
      <RadioGroupContext.Provider value={{ value, onValueChange, name }}>
        <div
          ref={ref}
          className={cn("grid gap-2", className)}
          role="radiogroup"
          {...props}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    )
  }
)
RadioGroup.displayName = "RadioGroup"

interface RadioGroupItemProps extends React.HTMLAttributes<HTMLInputElement> {
  value: string
  id?: string
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value: itemValue, id, ...props }, ref) => {
    const { value, onValueChange, name } = React.useContext(RadioGroupContext)

    return (
      <input
        ref={ref}
        type="radio"
        id={id}
        name={name}
        value={itemValue}
        checked={value === itemValue}
        onChange={() => onValueChange(itemValue)}
        className={cn(
          "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }