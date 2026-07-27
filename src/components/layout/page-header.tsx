import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

/** Consistent title/description/actions row used at the top of every module page. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
