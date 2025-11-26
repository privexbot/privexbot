/**
 * Tooltip Component
 */

import * as React from "react"
import { cn } from "@/lib/utils"

interface TooltipContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const TooltipContext = React.createContext<TooltipContextType>({
  open: false,
  setOpen: () => {}
})

interface TooltipProviderProps {
  children: React.ReactNode
}

const TooltipProvider = ({ children }: TooltipProviderProps) => {
  return <>{children}</>
}

interface TooltipProps {
  children: React.ReactNode
}

const Tooltip = ({ children }: TooltipProps) => {
  const [open, setOpen] = React.useState(false)

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">
        {children}
      </div>
    </TooltipContext.Provider>
  )
}

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
  asChild?: boolean
}

const TooltipTrigger = React.forwardRef<HTMLElement, TooltipTriggerProps>(
  ({ children, asChild = false, ...props }, ref) => {
    const { setOpen } = React.useContext(TooltipContext)

    const handleMouseEnter = () => setOpen(true)
    const handleMouseLeave = () => setOpen(false)

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ...props,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        ref
      })
    }

    return (
      <span
        ref={ref as React.RefObject<HTMLSpanElement>}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </span>
    )
  }
)
TooltipTrigger.displayName = "TooltipTrigger"

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open } = React.useContext(TooltipContext)

    if (!open) return null

    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
          "bottom-full left-1/2 mb-2 -translate-x-1/2",
          "animate-in fade-in-0 zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover" />
      </div>
    )
  }
)
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }