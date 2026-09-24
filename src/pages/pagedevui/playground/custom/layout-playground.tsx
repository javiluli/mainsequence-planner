import { Flex, PageContent, PageHeader, Panel, Typography } from '@/shared/ui'
import { ComponentPlayground } from '../../components'

const paddingVariants = ['none', 'sm', 'md', 'lg'] as const

export const LayoutPlayground = () => (
  <ComponentPlayground id="layout" title="Layout surfaces">
    <Typography tone="soft">Shared page primitives define surface depth, spacing, and the page scroll boundary.</Typography>

    <div className="grid gap-4 md:grid-cols-2">
      <Panel padding="md">
        <Typography variant="h4">Default panel</Typography>
        <Typography variant="small" tone="soft">
          Primary grouped content.
        </Typography>
      </Panel>
      <Panel variant="muted" padding="md">
        <Typography variant="h4">Muted panel</Typography>
        <Typography variant="small" tone="soft">
          Secondary or dense content.
        </Typography>
      </Panel>
    </div>

    <Flex align="stretch" wrap="wrap" gap="md">
      {paddingVariants.map((padding) => (
        <Panel key={padding} padding={padding} className="min-h-20 min-w-32">
          <Typography variant="micro" tone="soft" className={padding === 'none' ? 'p-2' : undefined}>
            padding: {padding}
          </Typography>
        </Panel>
      ))}
    </Flex>

    <div className="flex min-h-52 flex-col gap-4 rounded-2xl border border-divider/70 bg-background p-4">
      <PageHeader>
        <Typography variant="h4">Page header</Typography>
      </PageHeader>
      <PageContent surface="muted" padding="md">
        <Typography variant="small" tone="soft">
          Page content owns the remaining space and its scroll behavior.
        </Typography>
      </PageContent>
    </div>
  </ComponentPlayground>
)
