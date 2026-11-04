import { ChevronDown } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/** ネイティブの <select>。モバイルで使いやすく、キーボード・スクリーンリーダーに強い */
function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className={cn('relative', className)}>
      <select
        data-slot="native-select"
        className={cn(
          'h-9 w-full appearance-none rounded-md border border-input bg-transparent py-1 pr-8 pl-3 text-base shadow-xs outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive',
          '[&>option]:bg-popover [&>option]:text-popover-foreground',
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { NativeSelect }
