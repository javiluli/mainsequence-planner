import { Switch } from '@heroui/react'

type Props = {
  label?: string
  isSelected: boolean | undefined
  onValueChange: (isSelected: boolean) => void | undefined
  className?: string
}

export const ControlSwitch = ({ label, isSelected, onValueChange }: Props) => {
  return (
    <Switch size="sm" color="default" isSelected={isSelected} onValueChange={onValueChange}>
      {label}
    </Switch>
  )
}
