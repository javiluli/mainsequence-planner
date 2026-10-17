import { Button } from '@heroui/react'
import { useState } from 'react'
import { ComponentPlayground, ControlSelect, ControlSwitch, PlaygroundControls, PlaygroundPreview } from '../components'
import { colors, radius, sizes } from '../constant'

const variants = [
  { key: 'solid', label: 'Solid' },
  { key: 'faded', label: 'Faded' },
  { key: 'bordered', label: 'Bordered' },
  { key: 'light', label: 'Light' },
  { key: 'flat', label: 'Flat' },
  { key: 'ghost', label: 'Ghost' },
  { key: 'shadow', label: 'Shadow' },
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

export const ButtonPlayground = () => {
  const [variant, setVariant] = useState<Variant>(defaultValues.variant)
  const [size, setSize] = useState<Size>(defaultValues.size)
  const [rounded, setRounded] = useState<Radius>(defaultValues.radius)
  const [isDisabled, setIsDisabled] = useState(defaultValues.isDisabled)

  return (
    <ComponentPlayground id="button" title="Button">
      <PlaygroundControls>
        <ControlSelect label="Variant" value={variant} onChange={setVariant} options={variants} />
        <ControlSelect label="Size" value={size} onChange={setSize} options={sizes} />
        <ControlSelect label="Radius" value={rounded} onChange={setRounded} options={radius} />
        <ControlSwitch label="Disabled" isSelected={isDisabled} onValueChange={setIsDisabled} />
      </PlaygroundControls>

      <PlaygroundPreview>
        {colors.map((color) => (
          <Button key={color} color={color as Color} variant={variant} size={size} radius={rounded} isDisabled={isDisabled}>
            {color}
          </Button>
        ))}
      </PlaygroundPreview>
    </ComponentPlayground>
  )
}
