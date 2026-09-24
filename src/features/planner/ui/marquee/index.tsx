import { cn } from '@heroui/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import './styles.css'

export interface MarqueeProps {
  children: ReactNode | ((isPrimary: boolean) => ReactNode)
  animationDuration?: number
  reverse?: boolean
}

export function Marquee({ children, animationDuration = 200, reverse = false }: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [repetitions, setRepetitions] = useState(2)

  useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    let containerWidth = 0
    let contentWidth = 0

    const updateRepetitions = () => {
      if (contentWidth <= 0) return

      const needed = Math.ceil(containerWidth / contentWidth) + 2
      setRepetitions((current) => (current === needed ? current : needed))
    }

    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === container) containerWidth = entry.contentRect.width
        if (entry.target === content) contentWidth = entry.contentRect.width
      })
      updateRepetitions()
    })

    observer.observe(container)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="relative flex w-full overflow-hidden py-4">
      <div className="bg-linear-to-r/srgb from-background from-5% via-transparent to-background to-95% pointer-events-none absolute inset-y-0 top-0 right-0 w-full h-full z-10" />

      <div
        data-testid="planner-marquee-track"
        className={cn('animate-marquee-pause flex w-max flex-nowrap', reverse ? 'animate-marquee-reverse' : 'animate-marquee')}
        style={
          {
            '--duration': `${animationDuration}s`,
            '--count': repetitions,
          } as React.CSSProperties
        }
      >
        {/* Renderizado dinámico */}
        {[...Array(repetitions)].map((_, i) => (
          <div
            key={i}
            ref={i === 0 ? contentRef : null}
            aria-hidden={i === 0 ? undefined : true}
            data-testid={i === 0 ? 'planner-marquee-primary' : 'planner-marquee-copy'}
            className="flex shrink-0 items-center gap-4 px-2"
          >
            {typeof children === 'function' ? children(i === 0) : children}
          </div>
        ))}
      </div>
    </div>
  )
}
