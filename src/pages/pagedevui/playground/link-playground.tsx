import { Link } from '@heroui/react'
import { useState } from 'react'
import { ComponentPlayground, ControlSelect, ControlSwitch, PlaygroundControls, PlaygroundPreview } from '../components'
import { sizes } from '../constant'

const colors = ['foreground', 'primary', 'secondary', 'success', 'warning', 'danger'] as const

const underlines = [
  { key: 'none', label: 'none' },
  { key: 'hover', label: 'hover' },
  { key: 'always', label: 'always' },
  { key: 'active', label: 'active' },
  { key: 'focus', label: 'focus' },
] as const

type Size = (typeof sizes)[number]['key']
type Underline = (typeof underlines)[number]['key']

const defaultValues = {
  size: 'md' as Size,
  underline: 'none' as Underline,
  isDisabled: false,
  isBlock: false,
  showAnchorIcon: false,
}

export const LinkPlayground = () => {
  const [size, setSize] = useState<Size>(defaultValues.size)
  const [underline, setUnderline] = useState<Underline>(defaultValues.underline)
  const [isDisabled, setIsDisabled] = useState(defaultValues.isDisabled)
  const [isBlock, setIsBlockd] = useState(defaultValues.isBlock)
  const [showAnchorIcon, setShowAnchorIcon] = useState(defaultValues.showAnchorIcon)

  return (
    <ComponentPlayground id="link" title="Link">
      <PlaygroundControls>
        <ControlSelect label="Size" value={size} onChange={setSize} options={sizes} />
        <ControlSelect label="Underline" value={underline} onChange={setUnderline} options={underlines} />
        <ControlSwitch label="Disabled" isSelected={isDisabled} onValueChange={setIsDisabled} />
        <ControlSwitch label="Block Link" isSelected={isBlock} onValueChange={setIsBlockd} />
        <ControlSwitch label="Show Anchor Icon" isSelected={showAnchorIcon} onValueChange={setShowAnchorIcon} />
      </PlaygroundControls>

      <PlaygroundPreview>
        {colors.map((color) => (
          <Link
            color={color}
            href="#"
            size={size}
            underline={underline}
            isDisabled={isDisabled}
            isBlock={isBlock}
            showAnchorIcon={showAnchorIcon}
          >
            {color}
          </Link>
        ))}
      </PlaygroundPreview>
    </ComponentPlayground>
  )
}
