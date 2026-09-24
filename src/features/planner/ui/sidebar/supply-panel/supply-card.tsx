import { Flex, AssetImage } from '@/shared/ui'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'
import { Button, Card, CardBody, NumberInput } from '@heroui/react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { memo } from 'react'

interface SupplyCardProps {
  itemId: string
  itemName: string
  value: number
}

export const SupplyCard = memo(({ itemId, itemName, value }: SupplyCardProps) => {
  const incrementSupply = usePlannerStore(plannerSelectors.incrementSupply)
  const setSupply = usePlannerStore(plannerSelectors.setSupply)

  const handleUpdateSupply = (val: number) => {
    setSupply(itemId, val)
  }
  const addx1ItemsSupply = () => incrementSupply(itemId, 1)
  const removex1ItemsSupply = () => incrementSupply(itemId, -1)
  const addx10ItemsSupply = () => incrementSupply(itemId, 10)
  const removex10ItemsSupply = () => incrementSupply(itemId, -10)

  return (
    <Card className="border border-divider/60 bg-content1/75 shadow-none">
      <CardBody className="gap-3 p-3">
        <Flex gap="sm" className="min-w-0">
          <AssetImage kind="items" id={itemId} width={48} alt="" />
          <Flex direction="col" align="start" gap="none" className="min-w-0">
            <span className="min-w-0 break-words text-sm font-medium">{itemName}</span>
            <span className="text-xs text-foreground/60">Continuous delivery · items/min</span>
          </Flex>
        </Flex>

        <Flex gap="none" className="w-full min-w-0 rounded-medium border border-divider/60 bg-content2/40">
          <Button isIconOnly size="sm" variant="light" aria-label={`Decrease ${itemName} supply by 10`} onPress={removex10ItemsSupply}>
            <ChevronsLeft size={18} />
          </Button>
          <Button isIconOnly size="sm" variant="light" aria-label={`Decrease ${itemName} supply by 1`} onPress={removex1ItemsSupply}>
            <ChevronLeft size={18} />
          </Button>
          <NumberInput
            aria-label={`${itemName} continuous supply in items per minute`}
            hideStepper
            size="sm"
            variant="faded"
            className="min-w-0 flex-1"
            classNames={{
              inputWrapper: 'bg-transparent shadow-none',
              input: 'text-center tabular-nums',
            }}
            minValue={0.01}
            step={0.01}
            value={value}
            onChange={(val) => handleUpdateSupply(Number(val))}
          />
          <Button isIconOnly size="sm" variant="light" aria-label={`Increase ${itemName} supply by 1`} onPress={addx1ItemsSupply}>
            <ChevronRight size={18} />
          </Button>
          <Button isIconOnly size="sm" variant="light" aria-label={`Increase ${itemName} supply by 10`} onPress={addx10ItemsSupply}>
            <ChevronsRight size={18} />
          </Button>
        </Flex>
      </CardBody>
    </Card>
  )
})
