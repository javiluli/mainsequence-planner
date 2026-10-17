import { Flex } from '@/shared/ui'
import { Button, cn, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react'
import { ComponentPlayground, PlaygroundPreview } from '../../components'

type ScaleStep = {
  key: string
  value: string
}

const ScaleSwatch = ({ label, className }: { label: string; className: string }) => (
  <Flex direction="col" justify="center">
    <div className={cn('h-6 w-6 rounded', className)} />
    <span className="text-xs">{label}</span>
  </Flex>
)

const ThemeScaleDropdown = ({ label, colors }: { label: string; colors: ScaleStep[] }) => (
  <Flex wrap="wrap" gap="md">
    <Dropdown>
      <DropdownTrigger>
        <Button color={label as never}>{label}</Button>
      </DropdownTrigger>
      <DropdownMenu disableAnimation aria-label="Theme scale">
        <DropdownItem isReadOnly key="scale">
          <div className="grid grid-cols-5 gap-1 gap-y-3">
            {colors.map((c) => (
              <ScaleSwatch key={c.key} label={c.key} className={c.value} />
            ))}
          </div>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  </Flex>
)

const ThemeScaleForegroundDropdown = ({ label, colors }: { label: string; colors: ScaleStep[] }) => (
  <Flex wrap="wrap" gap="md">
    <Dropdown>
      <DropdownTrigger>
        <Button className="bg-foreground text-background">{label}</Button>
      </DropdownTrigger>
      <DropdownMenu disableAnimation aria-label="Theme scale">
        <DropdownItem isReadOnly key="scale">
          <div className="grid grid-cols-5 gap-1 gap-y-3">
            {colors.map((c) => (
              <ScaleSwatch key={c.key} label={c.key} className={c.value} />
            ))}
          </div>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  </Flex>
)

const defaultScale: ScaleStep[] = [
  { key: '50', value: `bg-default-50` },
  { key: '100', value: `bg-default-100` },
  { key: '200', value: `bg-default-200` },
  { key: '300', value: `bg-default-300` },
  { key: '400', value: `bg-default-400` },
  { key: '500', value: `bg-default-500` },
  { key: '600', value: `bg-default-600` },
  { key: '700', value: `bg-default-700` },
  { key: '800', value: `bg-default-800` },
  { key: '900', value: `bg-default-900` },
]

const primaryScale: ScaleStep[] = [
  { key: '50', value: `bg-primary-50` },
  { key: '100', value: `bg-primary-100` },
  { key: '200', value: `bg-primary-200` },
  { key: '300', value: `bg-primary-300` },
  { key: '400', value: `bg-primary-400` },
  { key: '500', value: `bg-primary-500` },
  { key: '600', value: `bg-primary-600` },
  { key: '700', value: `bg-primary-700` },
  { key: '800', value: `bg-primary-800` },
  { key: '900', value: `bg-primary-900` },
]

const secondaryScale: ScaleStep[] = [
  { key: '50', value: `bg-secondary-50` },
  { key: '100', value: `bg-secondary-100` },
  { key: '200', value: `bg-secondary-200` },
  { key: '300', value: `bg-secondary-300` },
  { key: '400', value: `bg-secondary-400` },
  { key: '500', value: `bg-secondary-500` },
  { key: '600', value: `bg-secondary-600` },
  { key: '700', value: `bg-secondary-700` },
  { key: '800', value: `bg-secondary-800` },
  { key: '900', value: `bg-secondary-900` },
]

const successScale: ScaleStep[] = [
  { key: '50', value: `bg-success-50` },
  { key: '100', value: `bg-success-100` },
  { key: '200', value: `bg-success-200` },
  { key: '300', value: `bg-success-300` },
  { key: '400', value: `bg-success-400` },
  { key: '500', value: `bg-success-500` },
  { key: '600', value: `bg-success-600` },
  { key: '700', value: `bg-success-700` },
  { key: '800', value: `bg-success-800` },
  { key: '900', value: `bg-success-900` },
]

const warningScale: ScaleStep[] = [
  { key: '50', value: `bg-warning-50` },
  { key: '100', value: `bg-warning-100` },
  { key: '200', value: `bg-warning-200` },
  { key: '300', value: `bg-warning-300` },
  { key: '400', value: `bg-warning-400` },
  { key: '500', value: `bg-warning-500` },
  { key: '600', value: `bg-warning-600` },
  { key: '700', value: `bg-warning-700` },
  { key: '800', value: `bg-warning-800` },
  { key: '900', value: `bg-warning-900` },
]

const dangerScale: ScaleStep[] = [
  { key: '50', value: `bg-danger-50` },
  { key: '100', value: `bg-danger-100` },
  { key: '200', value: `bg-danger-200` },
  { key: '300', value: `bg-danger-300` },
  { key: '400', value: `bg-danger-400` },
  { key: '500', value: `bg-danger-500` },
  { key: '600', value: `bg-danger-600` },
  { key: '700', value: `bg-danger-700` },
  { key: '800', value: `bg-danger-800` },
  { key: '900', value: `bg-danger-900` },
]

const foregroundScale: ScaleStep[] = [
  { key: '50', value: `bg-foreground-50` },
  { key: '100', value: `bg-foreground-100` },
  { key: '200', value: `bg-foreground-200` },
  { key: '300', value: `bg-foreground-300` },
  { key: '400', value: `bg-foreground-400` },
  { key: '500', value: `bg-foreground-500` },
  { key: '600', value: `bg-foreground-600` },
  { key: '700', value: `bg-foreground-700` },
  { key: '800', value: `bg-foreground-800` },
  { key: '900', value: `bg-foreground-900` },
]

export const Theme = () => {
  return (
    <ComponentPlayground id="theme" title="Theme">
      <PlaygroundPreview>
        <Flex direction="col" align="start" gap="md">
          <span className="text-medium font-semibold">Brand colors</span>
          <Flex wrap="wrap" gap="md">
            <ThemeScaleDropdown label="default" colors={defaultScale} />
            <ThemeScaleDropdown label="primary" colors={primaryScale} />
            <ThemeScaleDropdown label="secondary" colors={secondaryScale} />
            <ThemeScaleDropdown label="success" colors={successScale} />
            <ThemeScaleDropdown label="warning" colors={warningScale} />
            <ThemeScaleDropdown label="danger" colors={dangerScale} />
          </Flex>
        </Flex>

        <Flex direction="col" align="start" gap="md">
          <span className="text-medium font-semibold">Base colors</span>
          <Flex wrap="wrap" gap="md">
            <Button className="bg-background">background</Button>
            <ThemeScaleForegroundDropdown label="foreground" colors={foregroundScale} />
            <Button className="bg-content1">content1</Button>
            <Button className="bg-content2">content2</Button>
            <Button className="bg-content3">content3</Button>
            <Button className="bg-content4">content4</Button>
          </Flex>
        </Flex>

        <Flex direction="col" align="start" gap="md">
          <span className="text-medium font-semibold">Other colors</span>
          <Flex wrap="wrap" gap="md">
            <Button className="bg-focus">focus</Button>
            <Button className="bg-overlay">overlay</Button>
            <Button className="bg-divider">divider</Button>
          </Flex>
        </Flex>
      </PlaygroundPreview>
    </ComponentPlayground>
  )
}
