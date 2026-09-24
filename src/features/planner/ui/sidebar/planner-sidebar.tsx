import { Tab, Tabs } from '@heroui/react'
import { memo } from 'react'
import { RecipeOptionsPanel } from './recipe-options-panel'
import { SupplyPanel } from './supply-panel'

export const PlannerSidebar = memo(() => {
  return (
    <Tabs
      placement="top"
      variant="underlined"
      aria-label="Planner settings"
      fullWidth
      classNames={{
        tabWrapper: 'flex h-full min-h-0 w-full flex-col overflow-hidden',
        base: 'w-full shrink-0',
        tabList: 'w-full',
        panel: 'min-h-0 flex-1 overflow-hidden p-0',
      }}
    >
      <Tab key="supply" title="Supply">
        <SupplyPanel />
      </Tab>

      <Tab key="recipes" title="Recipes">
        <RecipeOptionsPanel />
      </Tab>
    </Tabs>
  )
})
