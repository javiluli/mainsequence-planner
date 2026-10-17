import { cn, Select, SelectItem, type Selection } from '@heroui/react'

type Option<T extends string> = {
  key: T
  label: string
}

type TypedSelectProps<T extends string> = {
  label?: string
  value: T
  onChange: (value: T) => void
  options: readonly Option<T>[]
  className?: string
}

export const ControlSelect = <T extends string>({ label, value, onChange, options, className }: TypedSelectProps<T>) => {
  const handleChange = (keys: Selection) => {
    const selected = Array.from(keys)[0] as T
    if (selected) onChange(selected)
  }

  return (
    <Select
      label={label}
      size="sm"
      className={cn('w-34', className)}
      labelPlacement="outside-top"
      selectedKeys={new Set([value])}
      onSelectionChange={handleChange}
    >
      {options.map((opt) => (
        <SelectItem key={opt.key}>{opt.label}</SelectItem>
      ))}
    </Select>
  )
}
