import { Flex, AssetImage, Typography } from '@/shared/ui'
import { filterItemsByQuery, groupItemsByType, SUPPLY_ITEM_TYPE_ORDER } from '@/features/planner/lib/supply-count-items'
import { items } from '@/shared/data'
import { Button, Chip, Input, Modal, ModalBody, ModalContent, ModalHeader, useDisclosure } from '@heroui/react'
import { SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'

export function SupplyModal() {
  const supplyCountByItem = usePlannerStore(plannerSelectors.supplyCountByItem)
  const setSupply = usePlannerStore(plannerSelectors.setSupply)

  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure()
  const [search, setSearch] = useState('')

  const filteredItems = useMemo(() => filterItemsByQuery(items, search), [search])
  const itemsByType = useMemo(() => groupItemsByType(filteredItems), [filteredItems])

  const handleSupply = (itemId: string) => {
    setSupply(itemId, supplyCountByItem[itemId] ?? 1)
    setSearch('')
    onClose()
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) setSearch('')
    onOpenChange()
  }

  return (
    <>
      <Flex justify="end" className="w-full">
        <Button aria-label="Add supply item" onPress={onOpen}>
          Add an item
        </Button>
      </Flex>
      <Modal isOpen={isOpen} size="5xl" scrollBehavior="inside" onOpenChange={handleOpenChange}>
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <Typography variant="h3">Select input items</Typography>
              </ModalHeader>
              <ModalBody>
                <Input
                  fullWidth
                  aria-label="Search supply items"
                  variant="bordered"
                  placeholder="Type to search…"
                  startContent={<SearchIcon aria-hidden size={18} />}
                  type="search"
                  value={search}
                  onValueChange={setSearch}
                />

                {filteredItems.length === 0 && (
                  <Flex direction="col" align="center" className="gap-3 py-10 text-center" role="status">
                    <Typography variant="body" tone="soft">
                      No supply items found
                    </Typography>
                    <Button variant="flat" onPress={() => setSearch('')}>
                      Clear search
                    </Button>
                  </Flex>
                )}

                {SUPPLY_ITEM_TYPE_ORDER.map((type) => {
                  const sectionItems = itemsByType[type]

                  if (!sectionItems.length) return null

                  return (
                    <div key={type} className="mb-6">
                      <Flex justify="between" className="mb-3">
                        <Typography variant="micro" tone="soft" className="uppercase tracking-wide">
                          {type}
                        </Typography>
                        <Chip size="sm" variant="bordered" className="text-foreground/80">
                          {sectionItems.length} items
                        </Chip>
                      </Flex>

                      <ul className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                        {sectionItems.map((i) => (
                          <li key={i.id}>
                            <button
                              type="button"
                              aria-label={`Add ${i.name} as supply`}
                              className={
                                'group flex w-full flex-col items-center gap-2 rounded-2xl p-3 transition-colors hover:bg-content3/60 ' +
                                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                              }
                              onClick={() => handleSupply(i.id)}
                            >
                              <AssetImage kind="items" id={i.id} width={96} alt="" />
                              <Typography
                                as="span"
                                variant="micro"
                                tone="soft"
                                className="text-center transition-colors group-hover:text-foreground"
                              >
                                {i.name}
                              </Typography>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}
