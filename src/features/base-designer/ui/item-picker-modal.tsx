import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { Search, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Item } from '@/shared/@types/item.type'
import { AssetImage } from '@/shared/ui/asset-image'

interface ItemPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  items: readonly Item[]
  selectedItemId: string | null
  onSelect: (itemId: string | null) => void
  closeOnSelect?: boolean
  context?: ReactNode
  emptyMessage?: string
}

/** Catalog-backed visual item picker shared by drones and machines. */
export function ItemPickerModal({
  open,
  onOpenChange,
  title,
  description,
  items,
  selectedItemId,
  onSelect,
  closeOnSelect = false,
  context,
  emptyMessage = 'No eligible items are available.',
}: ItemPickerModalProps) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matches = normalizedQuery ? items.filter((item) => item.name.toLocaleLowerCase().includes(normalizedQuery)) : items
  const changeOpen = (next: boolean) => {
    if (!next) setQuery('')
    onOpenChange(next)
  }
  const selectItem = (itemId: string | null) => {
    onSelect(itemId)
    if (closeOnSelect) changeOpen(false)
  }

  return (
    <Modal isOpen={open} onOpenChange={changeOpen} size="2xl" scrollBehavior="inside" classNames={{ base: 'rounded-sm bg-content1' }}>
      <ModalContent>
        <ModalHeader className="border-b border-divider text-base">{title}</ModalHeader>
        <ModalBody className="gap-4 py-4">
          <p className="text-sm text-foreground/70">{description}</p>
          {context}
          {items.length ? (
            <>
              <Input
                type="search"
                aria-label="Search items"
                placeholder="Search items…"
                size="sm"
                value={query}
                onValueChange={setQuery}
                startContent={<Search size={16} aria-hidden className="text-foreground/55" />}
                classNames={{ inputWrapper: 'rounded-sm border border-divider bg-content2 shadow-none' }}
              />
              {matches.length ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Available items">
                  {matches.map((item) => (
                    <Button
                      key={item.id}
                      variant="flat"
                      className={`h-14 min-w-0 justify-start gap-3 rounded-sm border px-3 text-left ${
                        selectedItemId === item.id ? 'border-primary bg-primary/10' : 'border-divider bg-content2 hover:border-primary/60'
                      }`}
                      onPress={() => selectItem(item.id)}
                      aria-pressed={selectedItemId === item.id}
                      startContent={<AssetImage kind="items" id={item.id} width={32} alt="" />}
                    >
                      <span className="min-w-0 truncate text-xs font-medium" title={item.name}>
                        {item.name}
                      </span>
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="py-5 text-center text-sm text-foreground/60">No items match this search.</p>
              )}
            </>
          ) : (
            <p className="border border-divider bg-content2 p-3 text-sm text-foreground/75">{emptyMessage}</p>
          )}
        </ModalBody>
        <ModalFooter className="border-t border-divider">
          {selectedItemId ? (
            <Button variant="light" color="danger" size="sm" onPress={() => selectItem(null)} startContent={<X size={14} aria-hidden />}>
              Clear assignment
            </Button>
          ) : null}
          <Button variant="flat" size="sm" onPress={() => changeOpen(false)}>
            Done
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
