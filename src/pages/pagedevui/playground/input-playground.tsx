import { Input } from '@heroui/react'
import { useState } from 'react'
import { ComponentPlayground, ControlSelect, ControlSwitch, PlaygroundControls, PlaygroundPreview } from '../components'
import { colors, placements, radius, sizes } from '../constant'

const variants = [
  { key: 'flat', label: 'Flat' },
  { key: 'bordered', label: 'Bordered' },
  { key: 'faded', label: 'Faded' },
  { key: 'underlined', label: 'Underlined' },
] as const

type Variant = (typeof variants)[number]['key']
type Size = (typeof sizes)[number]['key']
type Radius = (typeof radius)[number]['key']
type Placements = (typeof placements)[number]['key']

const defaultValues = {
  variant: 'flat' as Variant,
  size: 'md' as Size,
  radius: 'md' as Radius,
  placement: 'inside' as Placements,
  isDisabled: false,
}

export const InputPlayground = () => {
  const [variant, setVariant] = useState<Variant>(defaultValues.variant)
  const [size, setSize] = useState<Size>(defaultValues.size)
  const [rounded, setRounded] = useState<Radius>(defaultValues.radius)
  const [placement, setPlacement] = useState<Placements>(defaultValues.placement)
  const [isDisabled, setIsDisabled] = useState(defaultValues.isDisabled)

  return (
    <ComponentPlayground id="input" title="Input">
      <PlaygroundControls>
        <ControlSelect label="Variant" value={variant} onChange={setVariant} options={variants} />
        <ControlSelect label="Size" value={size} onChange={setSize} options={sizes} />
        <ControlSelect label="Radius" value={rounded} onChange={setRounded} options={radius} />
        <ControlSelect label="Placement" value={placement} onChange={setPlacement} options={placements} />
        <ControlSwitch label="Disabled" isSelected={isDisabled} onValueChange={setIsDisabled} />
      </PlaygroundControls>

      <PlaygroundPreview>
        {colors.map((color) => (
          <Input
            key={color}
            className="max-w-sm"
            color={color}
            variant={variant}
            size={size}
            radius={rounded}
            labelPlacement={placement}
            isDisabled={isDisabled}
            defaultValue="junior@heroui.com"
            label="Email"
            placeholder="Enter your email"
            type="email"
          />
        ))}
      </PlaygroundPreview>
    </ComponentPlayground>
  )
}
