import { Flex } from '@/shared/ui'

interface Props {
  children: React.ReactNode
}

export const PlaygroundPreview = ({ children, ...props }: Props) => (
  <Flex wrap="wrap" gap="xl" {...props}>
    {children}
  </Flex>
)
