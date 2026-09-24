import { Flex, Typography } from '@/shared/ui'
import { Divider, Link } from '@heroui/react'
import { customization, sections } from '../constant'

const SidebarLinks = ({ links }: { links: typeof sections }) => (
  <Flex direction="col" align="start" gap="xs">
    {links.map((section) => (
      <Link key={section.id} href={`#${section.id}`} className="text-foreground/70 hover:text-foreground">
        {section.label}
      </Link>
    ))}
  </Flex>
)

export const Sidebar = () => (
  <aside className="sticky top-4 hidden h-fit w-56 space-y-4 lg:block">
    <Typography variant="h4" className="font-bold uppercase tracking-wide">
      Foundations
    </Typography>
    <SidebarLinks links={customization} />

    <Divider />

    <Typography variant="h4" className="font-bold uppercase tracking-wide">
      Components
    </Typography>
    <SidebarLinks links={sections} />
  </aside>
)
