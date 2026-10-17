import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react'
import { useState } from 'react'
import { ComponentPlayground, ControlSelect, PlaygroundControls, PlaygroundPreview } from '../components'
import { colors } from '../constant'

const variants = [
  { key: 'solid', label: 'Solid' },
  { key: 'faded', label: 'Faded' },
  { key: 'bordered', label: 'Bordered' },
  { key: 'light', label: 'Light' },
  { key: 'flat', label: 'Flat' },
  { key: 'shadow', label: 'Shadow' },
] as const

type Color = (typeof colors)[number]
type Variant = (typeof variants)[number]['key']

const defaultValues = {
  variant: 'solid' as Variant,
}

export const DropdownPlayground = () => {
  const [variant, setVariant] = useState<Variant>(defaultValues.variant)

  return (
    <ComponentPlayground id="dropdown" title="Dropdown">
      <PlaygroundControls>
        <ControlSelect label="Variant" value={variant} onChange={setVariant} options={variants} />
      </PlaygroundControls>

      <PlaygroundPreview>
        {colors.map((color) => (
          <Dropdown>
            <DropdownTrigger>
              <Button color={color as Color} variant={variant}>
                {color}
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Dropdown Variants" color={color} variant={variant}>
              <DropdownItem key="new">New file</DropdownItem>
              <DropdownItem key="copy">Copy link</DropdownItem>
              <DropdownItem key="edit">Edit file</DropdownItem>
              <DropdownItem key="delete" className="text-danger" color="danger">
                Delete file
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        ))}
      </PlaygroundPreview>
    </ComponentPlayground>
  )
}
