import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/** Toast host (design-system.md §7: every action ends in a toast). Light theme only. */
const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="light"
    className="toaster group"
    position="bottom-right"
    icons={{
      success: <CircleCheckIcon className="size-4 text-status-success" />,
      info: <InfoIcon className="size-4 text-status-info" />,
      warning: <TriangleAlertIcon className="size-4 text-status-warning" />,
      error: <OctagonXIcon className="size-4 text-status-danger" />,
      loading: <Loader2Icon className="size-4 animate-spin" />,
    }}
    style={
      {
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius-md)",
      } as React.CSSProperties
    }
    {...props}
  />
)

export { Toaster }
