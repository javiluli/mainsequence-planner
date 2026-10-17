import { Button, Tooltip } from '@heroui/react'
import { useState } from 'react'
import { ComponentPlayground, ControlSelect, ControlSwitch, PlaygroundControls, PlaygroundPreview } from '../components'
import { colors, radius, sizes } from '../constant'

const placements = [
  { key: 'top-start', label: 'top-start' },
  { key: 'top', label: 'top' },
  { key: 'top-end', label: 'top-end' },
  { key: 'bottom-start', label: 'bottom-start' },
  { key: 'bottom', label: 'bottom' },
  { key: 'bottom-end', label: 'bottom-end' },
  { key: 'left-start', label: 'left-start' },
  { key: 'left', label: 'left' },
  { key: 'left-end', label: 'left-end' },
  { key: 'right-start', label: 'right-start' },
  { key: 'right', label: 'right' },
  { key: 'right-end', label: 'right-end' },
] as const

type Size = (typeof sizes)[number]['key']
type Radius = (typeof radius)[number]['key']
type Placement = (typeof placements)[number]['key']

const defaultValues = {
  size: 'md' as Size,
  radius: 'md' as Radius,
  placement: 'top' as Placement,
  showArrow: false,
}

export const TooltipPlayground = () => {
  const [size, setSize] = useState<Size>(defaultValues.size)
  const [rounded, setRounded] = useState<Radius>(defaultValues.radius)
  const [placement, setPlacement] = useState<Placement>(defaultValues.placement)
  const [showArrow, setShowArrow] = useState(defaultValues.showArrow)

  return (
    <ComponentPlayground id="tooltip" title="Tooltip">
      <PlaygroundControls>
        <ControlSelect label="Size" value={size} onChange={setSize} options={sizes} />
        <ControlSelect label="Radius" value={rounded} onChange={setRounded} options={radius} />
        <ControlSelect label="Placement" value={placement} onChange={setPlacement} options={placements} />
        <ControlSwitch label="With Arrow" isSelected={showArrow} onValueChange={setShowArrow} />
      </PlaygroundControls>

      <PlaygroundPreview>
        {colors.map((color) => {
          return (
            <Tooltip
              key={color}
              className="capitalize"
              color={color}
              content={color}
              placement={placement}
              showArrow={showArrow}
              size={size}
              radius={rounded}
            >
              <Button className="capitalize" color={color} variant="flat">
                {color}
              </Button>
            </Tooltip>
          )
        })}
        <Tooltip
          className="capitalize"
          color="foreground"
          content="foreground"
          placement={placement}
          showArrow={showArrow}
          size={size}
          radius={rounded}
        >
          <Button className="bg-foreground/40 text-background capitalize" variant="flat">
            foreground
          </Button>
        </Tooltip>
      </PlaygroundPreview>
    </ComponentPlayground>
  )
}
