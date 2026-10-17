import { Chip } from '@heroui/react'
import { useState } from 'react'
import { ComponentPlayground, ControlSelect, ControlSwitch, PlaygroundControls, PlaygroundPreview } from '../components'
import { colors, radius, sizes } from '../constant'

const variants = [
  { key: 'solid', label: 'Solid' },
  { key: 'bordered', label: 'Bordered' },
  { key: 'light', label: 'Light' },
  { key: 'flat', label: 'Flat' },
  { key: 'faded', label: 'Faded' },
  { key: 'shadow', label: 'Shadow' },
  { key: 'dot', label: 'Dot' },
] as const

type Color = (typeof colors)[number]
type Variant = (typeof variants)[number]['key']
type Size = (typeof sizes)[number]['key']
type Radius = (typeof radius)[number]['key']

const defaultValues = {
  variant: 'solid' as Variant,
  size: 'md' as Size,
  radius: 'md' as Radius,
  isDisabled: false,
}

export const ChipPlayground = () => {
  const [variant, setVariant] = useState<Variant>(defaultValues.variant)
  const [size, setSize] = useState<Size>(defaultValues.size)
  const [rounded, setRounded] = useState<Radius>(defaultValues.radius)
  const [isDisabled, setIsDisabled] = useState(defaultValues.isDisabled)

  return (
    <ComponentPlayground id="chip" title="Chip">
      <PlaygroundControls>
        <ControlSelect label="Variant" value={variant} onChange={setVariant} options={variants} />
        <ControlSelect label="Size" value={size} onChange={setSize} options={sizes} />
        <ControlSelect label="Radius" value={rounded} onChange={setRounded} options={radius} />
        <ControlSwitch label="Disabled" isSelected={isDisabled} onValueChange={setIsDisabled} />
      </PlaygroundControls>

      <PlaygroundPreview>
        {colors.map((color) => (
          <Chip color={color as Color} variant={variant} size={size} radius={rounded} isDisabled={isDisabled}>
            {color}
          </Chip>
        ))}
      </PlaygroundPreview>
    </ComponentPlayground>
  )
}
