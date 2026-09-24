export const customization = [
  { id: 'theme', label: 'Theme tokens' },
  { id: 'typography', label: 'Typography' },
  { id: 'layout', label: 'Layout' },
  { id: 'treelist', label: 'TreeList' },
]

export const sections = [
  { id: 'accordion', label: 'Accordion' },
  { id: 'autocomplete', label: 'Autocomplete' },
  { id: 'button', label: 'Button' },
  { id: 'card', label: 'Card' },
  { id: 'checkbox', label: 'Checkbox' },
  { id: 'chip', label: 'Chip' },
  { id: 'dropdown', label: 'Dropdown' },
  { id: 'input', label: 'Input' },
  { id: 'link', label: 'Link' },
  { id: 'modal', label: 'Modal' },
  { id: 'numberinput', label: 'Number Input' },
  { id: 'select', label: 'Select' },
  { id: 'table', label: 'Table' },
  { id: 'tabs', label: 'Tabs' },
  { id: 'tooltip', label: 'Tooltip' },
]

export const colors = ['default', 'primary', 'secondary', 'success', 'warning', 'danger'] as const

export const sizes = [
  { key: 'sm', label: 'Small' },
  { key: 'md', label: 'Medium' },
  { key: 'lg', label: 'Large' },
] as const

export const radius = [
  { key: 'none', label: 'None' },
  { key: 'sm', label: 'Small' },
  { key: 'md', label: 'Medium' },
  { key: 'lg', label: 'Large' },
  { key: 'full', label: 'Full' },
] as const

export const placements = [
  { key: 'inside', label: 'Inside' },
  { key: 'outside', label: 'Outside' },
  { key: 'outside-left', label: 'Outside-left' },
  { key: 'outside-top', label: 'Outside-top' },
] as const

export const animals = [
  { label: 'Cat', key: 'cat', description: 'The second most popular pet in the world' },
  { label: 'Dog', key: 'dog', description: 'The most popular pet in the world' },
  { label: 'Elephant', key: 'elephant', description: 'The largest land animal' },
  { label: 'Lion', key: 'lion', description: 'The king of the jungle' },
  { label: 'Tiger', key: 'tiger', description: 'The largest cat species' },
  { label: 'Giraffe', key: 'giraffe', description: 'The tallest land animal' },
  {
    label: 'Dolphin',
    key: 'dolphin',
    description: 'A widely distributed and diverse group of aquatic mammals',
  },
  { label: 'Penguin', key: 'penguin', description: 'A group of aquatic flightless birds' },
  { label: 'Zebra', key: 'zebra', description: 'A several species of African equids' },
  {
    label: 'Shark',
    key: 'shark',
    description: 'A group of elasmobranch fish characterized by a cartilaginous skeleton',
  },
  {
    label: 'Whale',
    key: 'whale',
    description: 'Diverse group of fully aquatic placental marine mammals',
  },
  { label: 'Otter', key: 'otter', description: 'A carnivorous mammal in the subfamily Lutrinae' },
  { label: 'Crocodile', key: 'crocodile', description: 'A large semiaquatic reptile' },
]
