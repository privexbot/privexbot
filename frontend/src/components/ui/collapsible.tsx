/**
 * Collapsible Component
 */

import * as React from "react"
import { cn } from "@/lib/utils"

interface CollapsibleContextType {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CollapsibleContext = React.createContext<CollapsibleContextType>({
  open: false,
  onOpenChange: () => {}
})

interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
}

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ className, open: controlledOpen, onOpenChange, defaultOpen = false, children, ...props }, ref) => {
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen)

    const open = controlledOpen !== undefined ? controlledOpen : internalOpen
    const handleOpenChange = onOpenChange || setInternalOpen

    return (
      <CollapsibleContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
        <div
          ref={ref}
          className={cn(className)}
          {...props}
        >
          {children}
        </div>
      </CollapsibleContext.Provider>
    )
  }
)
Collapsible.displayName = "Collapsible"

interface CollapsibleTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean
}

const CollapsibleTrigger = React.forwardRef<HTMLElement, CollapsibleTriggerProps>(
  ({ asChild = false, children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(CollapsibleContext)

    const handleClick = () => {
      onOpenChange(!open)
    }

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ...props,
        onClick: handleClick,
        ref,
        'aria-expanded': open,
        'data-state': open ? 'open' : 'closed'
      })
    }

    return (
      <button
        ref={ref as React.RefObject<HTMLButtonElement>}
        onClick={handleClick}
        aria-expanded={open}
        data-state={open ? 'open' : 'closed'}
        {...props}
      >
        {children}
      </button>
    )
  }
)
CollapsibleTrigger.displayName = "CollapsibleTrigger"

interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open } = React.useContext(CollapsibleContext)

    if (!open) return null

    return (
      <div
        ref={ref}
        className={cn(
          "overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
          className
        )}
        data-state={open ? 'open' : 'closed'}
        {...props}
      >
        {children}
      </div>
    )
  }
)
CollapsibleContent.displayName = "CollapsibleContent"

export { Collapsible, CollapsibleTrigger, CollapsibleContent }