import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-sm text-white placeholder:text-zinc-600 transition-colors outline-none focus:outline-none focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
