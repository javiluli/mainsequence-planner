import { Tab, Tabs } from '@heroui/react'
import { Images, Music, Video } from 'lucide-react'
import { useState } from 'react'
import { ComponentPlayground, ControlSelect, ControlSwitch, PlaygroundControls, PlaygroundPreview } from '../components'
import { colors, radius, sizes } from '../constant'

const variants = [
  { key: 'solid', label: 'Solid' },
  { key: 'underlined', label: 'Underlined' },
  { key: 'bordered', label: 'Bordered' },
  { key: 'light', label: 'Light' },
] as const

type Variant = (typeof variants)[number]['key']
type Size = (typeof sizes)[number]['key']
type Radius = (typeof radius)[number]['key']

const defaultValues = {
  variant: 'solid' as Variant,
  size: 'md' as Size,
  radius: 'md' as Radius,
  isDisabled: false,
  withIcons: false,
}

export const TabsPlayground = () => {
  const [variant, setVariant] = useState<Variant>(defaultValues.variant)
  const [size, setSize] = useState<Size>(defaultValues.size)
  const [rounded, setRounded] = useState<Radius>(defaultValues.radius)
  const [isDisabled, setIsDisabled] = useState(defaultValues.isDisabled)
  const [withIcons, setWithIcons] = useState(defaultValues.withIcons)

  return (
    <ComponentPlayground id="tabs" title="Tabs">
      <PlaygroundControls>
        <ControlSelect label="Variant" value={variant} onChange={setVariant} options={variants} />
        <ControlSelect label="Size" value={size} onChange={setSize} options={sizes} />
        <ControlSelect label="Radius" value={rounded} onChange={setRounded} options={radius} />
        <ControlSwitch label="Disabled" isSelected={isDisabled} onValueChange={setIsDisabled} />
        <ControlSwitch label="With icons" isSelected={withIcons} onValueChange={setWithIcons} />
      </PlaygroundControls>

      <PlaygroundPreview>
        {colors.map((color) => (
          <Tabs key={color} aria-label="Tabs colors" color={color} variant={variant} size={size} radius={rounded} isDisabled={isDisabled}>
            <Tab
              key="photos"
              title={
                <div className="flex items-center space-x-2">
                  {withIcons && <Images />}
                  <span>Photos</span>
                </div>
              }
            />
            <Tab
              key="music"
              title={
                <div className="flex items-center space-x-2">
                  {withIcons && <Music />}
                  <span>Music</span>
                </div>
              }
            />
            <Tab
              key="videos"
              title={
                <div className="flex items-center space-x-2">
                  {withIcons && <Video />}
                  <span>Videos</span>
                </div>
              }
            />
          </Tabs>
        ))}
      </PlaygroundPreview>
    </ComponentPlayground>
  )
}
