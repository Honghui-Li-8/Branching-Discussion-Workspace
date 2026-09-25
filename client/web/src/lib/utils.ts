import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// A05's type scale names its font sizes (`text-label`, `text-caption`, ...).
// Plain tailwind-merge does not know them and reads `text-label` as a text
// colour, so it drops the size whenever a colour class such as
// `text-text-default` follows and the element falls back to the inherited
// 16px. Registering the scale keeps size and colour as separate groups.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['hero', 'display', 'title', 'heading', 'body', 'label', 'caption'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
