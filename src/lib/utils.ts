import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwindクラスを結合し、競合するクラスは後勝ちでマージする（shadcn/ui標準ユーティリティ） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
