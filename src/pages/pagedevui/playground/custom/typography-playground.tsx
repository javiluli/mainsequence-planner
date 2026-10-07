import { Flex, Typography } from '@/shared/ui'
import { Divider } from '@heroui/react'
import { ComponentPlayground } from '../../components'

export const TypographyPlayground = () => (
  <ComponentPlayground id="typography" title="Font size / Line height (rem)">
    <Flex direction="col" align="start" gap="md">
      <Typography variant="display">Display Text</Typography>
      <Typography variant="h1">Heading 1</Typography>
      <Typography variant="h2">Heading 2</Typography>
      <Typography variant="h3">Heading 3</Typography>
      <Typography variant="h4">Heading 4</Typography>
      <Typography>Body</Typography>
      <Typography variant="small">Small</Typography>
      <Typography variant="micro">Micro</Typography>
    </Flex>

    <Divider />

    <Flex direction="col" align="start" gap="md">
      <p className="text-large">Large</p>
      <p className="text-medium">Medium</p>
      <p className="text-small">Small</p>
      <p className="text-tiny">Tiny</p>
    </Flex>
  </ComponentPlayground>
)
