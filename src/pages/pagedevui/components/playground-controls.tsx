import { Flex } from '@/shared/ui'

interface Props {
  children: React.ReactNode
}

export const PlaygroundControls = ({ children }: Props) => (
  <Flex wrap="wrap" align="end" gap="md">
    {children}
  </Flex>
)
