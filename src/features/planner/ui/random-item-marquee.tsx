import { AssetImage, Flex } from '@/shared/ui'
import { Marquee } from './marquee'
import { getRandomItemIds } from '@/features/planner/lib/random-items'
import { itemById, items } from '@/shared/data'
import { usePlannerTarget } from '@/features/planner/hooks/use-planner-target'
import { useMemo, type MouseEvent } from 'react'

const FEATURED_ITEM_ID = 'accumulator'
const MARQUEE_ITEM_COUNT = 16

export function RandomItemMarquee() {
  const { selectTargetItem } = usePlannerTarget()

  // Genera una muestra nueva al montar el estado vacio del Planner.
  const itemList = useMemo(() => {
    const randomItems = items.filter((item) => item.id !== FEATURED_ITEM_ID)
    return [FEATURED_ITEM_ID, ...getRandomItemIds(randomItems, MARQUEE_ITEM_COUNT - 1)]
  }, [])

  const handleTargetSelection = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return

    const target = event.target.closest<HTMLElement>('[data-planner-target-id]')
    if (!target || !event.currentTarget.contains(target)) return

    const itemId = target.dataset.plannerTargetId
    if (itemId) selectTargetItem(itemId)
  }

  return (
    <div onClick={handleTargetSelection}>
      <Marquee animationDuration={90}>
        {(isPrimary) =>
          itemList.map((id, index) => {
            const itemName = itemById.get(id)?.name ?? id.replaceAll('_', ' ')
            const image = (
              <AssetImage
                id={id}
                kind="items"
                width={96}
                alt=""
                loading={isPrimary && index === 0 ? 'eager' : 'lazy'}
                fetchPriority={isPrimary && index === 0 ? 'high' : 'auto'}
              />
            )

            return (
              <Flex key={`${id}-${index}`} justify="center" className="w-28 shrink-0">
                {isPrimary ? (
                  <button
                    type="button"
                    aria-label={`Select ${itemName} as production target`}
                    data-planner-target-id={id}
                    className="touch-manipulation rounded-lg border-0 bg-transparent p-0 transition-opacity hover:cursor-pointer hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {image}
                  </button>
                ) : (
                  <span
                    data-testid="planner-marquee-copy-item"
                    data-planner-target-id={id}
                    className="inline-flex touch-manipulation rounded-lg transition-opacity hover:cursor-pointer hover:opacity-80"
                  >
                    {image}
                  </span>
                )}
              </Flex>
            )
          })
        }
      </Marquee>
    </div>
  )
}
