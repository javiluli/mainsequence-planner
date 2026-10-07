import { Checkbox } from '@heroui/react'
import { useState } from 'react'
import { ComponentPlayground, ControlSelect, ControlSwitch, PlaygroundControls, PlaygroundPreview } from '../components'
import { colors, radius, sizes } from '../constant'

type Color = (typeof colors)[number]
type Size = (typeof sizes)[number]['key']
type Radius = (typeof radius)[number]['key']

const defaultValues = {
  size: 'md' as Size,
  radius: 'md' as Radius,
  isDisabled: false,
  lineThrough: false,
}

export const CheckboxPlayground = () => {
  const [size, setSize] = useState<Size>(defaultValues.size)
  const [rounded, setRounded] = useState<Radius>(defaultValues.radius)
  const [isDisabled, setIsDisabled] = useState(defaultValues.isDisabled)
  const [lineThrough, setLineThrough] = useState(defaultValues.lineThrough)

  return (
    <ComponentPlayground id="checkbox" title="Checkbox">
      <PlaygroundControls>
        <ControlSelect label="Size" value={size} onChange={setSize} options={sizes} />
        <ControlSelect label="Radius" value={rounded} onChange={setRounded} options={radius} />
        <ControlSwitch label="Disabled" isSelected={isDisabled} onValueChange={setIsDisabled} />
        <ControlSwitch label="Line Through" isSelected={lineThrough} onValueChange={setLineThrough} />
      </PlaygroundControls>

      <PlaygroundPreview>
        {colors.map((color) => (
          <Checkbox defaultSelected color={color as Color} size={size} radius={rounded} isDisabled={isDisabled} lineThrough={lineThrough}>
            {color}
          </Checkbox>
        ))}
      </PlaygroundPreview>
    </ComponentPlayground>
  )
}
