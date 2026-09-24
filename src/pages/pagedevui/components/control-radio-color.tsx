import { Radio, RadioGroup, cn } from '@heroui/react'

type Option<T extends string> = {
  key: T
  label: string
  color?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
}

type Props<T extends string> = {
  label?: string
  value: T
  onChange: (value: T) => void
  options: readonly Option<T>[]
  className?: string
}

export const ControlRadioColor = <T extends string>({ label, value, onChange, options, className }: Props<T>) => {
  return (
    <RadioGroup
      label={
        label && (
          <span className="block z-10 shrink-0 subpixel-antialiased text-tiny relative text-foreground pb-2 pointer-events-auto will-change-auto">
            {label}
          </span>
        )
      }
      orientation="horizontal"
      size="sm"
      value={value}
      onValueChange={(val) => onChange(val as T)}
      className={cn(className)}
    >
      {options.map((opt) => (
        <Radio key={opt.key} color={opt.color} className="capitalize" value={opt.key}>
          {opt.label}
        </Radio>
      ))}
    </RadioGroup>
  )
}
