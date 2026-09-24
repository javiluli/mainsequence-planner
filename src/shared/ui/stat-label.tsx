import { Typography } from './typography'

interface Props {
  value: string | number
  label: string
}

export const StatLabel = ({ value, label }: Props) => {
  return (
    <Typography as="span" variant="h3" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4.5 }}>
      <span>{value}</span>

      <Typography as="span" tone="soft">
        {formatLabel(value, label)}
      </Typography>
    </Typography>
  )
}

const formatLabel = (value: number | string, label: string) => {
  if (typeof value !== 'number') return label
  return value === 1 ? label : `${label}s`
}
