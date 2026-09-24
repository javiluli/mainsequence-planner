import { FlaskConical } from 'lucide-react'
import { useState } from 'react'

interface ResearchIconProps {
  icon?: string
  size: number
}

const iconExtensions = ['webp', 'png'] as const

export const ResearchIcon = ({ icon, size }: ResearchIconProps) => {
  const [sourceIndex, setSourceIndex] = useState(0)
  const extension = iconExtensions[sourceIndex]

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden border-r border-divider/70 bg-content2 text-foreground/45"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {icon && extension ? (
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/research/${icon}.${extension}`}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-1"
          onError={() => setSourceIndex((index) => index + 1)}
        />
      ) : (
        <FlaskConical size={Math.max(18, Math.round(size * 0.42))} />
      )}
    </span>
  )
}
