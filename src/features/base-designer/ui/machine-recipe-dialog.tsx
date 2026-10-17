import { Button, Input, Listbox, ListboxItem, Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { itemNameById } from '@/shared/data'
import { AssetImage } from '@/shared/ui/asset-image'
import { BUILDINGS, type Building } from '../model/buildings'
import { recipeForBuilding, recipesForBuilding } from '../lib/building-recipes'
import type { RecipeInput } from '@/shared/@types/building.type'

/** Exact nominal catalog amounts, shared by ingredients and genuine coproducts. */
function amounts(items: readonly RecipeInput[]): string {
  return items.map((item) => `${itemNameById.get(item.id) ?? item.id} ${item.amount_per_minute}/min`).join(' · ')
}

/** One click confirms a concrete recipe variant; search and dismissal never edit the layout. */
export function MachineRecipeDialog({
  building,
  onChoose,
  onClose,
}: {
  building: Building
  onChoose: (recipeId: string | null) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const recipes = recipesForBuilding(building.type)
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    return recipes.filter((recipe) => (itemNameById.get(recipe.output.id) ?? recipe.output.id).toLocaleLowerCase().includes(search))
  }, [query, recipes])
  const current = recipeForBuilding(building.type, building.recipeId)
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      size="xl"
      radius="sm"
      placement="center"
      scrollBehavior="inside"
      disableAnimation
    >
      <ModalContent onKeyDown={(event) => event.stopPropagation()}>
        <ModalHeader className="border-b border-divider">{BUILDINGS[building.type].label} · Recipe</ModalHeader>
        <ModalBody className="gap-4 py-5">
          <div className="flex min-w-0 items-center gap-3 rounded-md bg-content2 px-3 py-2">
            {current && <AssetImage kind="items" id={current.output.id} width={28} alt="" />}
            <span className="min-w-0 flex-1 text-sm">
              {current ? `${itemNameById.get(current.output.id)} · ${current.output.amount_per_minute}/min` : 'No recipe assigned'}
            </span>
            <Button size="sm" variant="light" isDisabled={!current} onPress={() => onChoose(null)}>
              Clear recipe
            </Button>
          </div>
          <Input autoFocus label="Search products" value={query} onValueChange={setQuery} startContent={<Search size={16} aria-hidden />} />
          <p className="text-xs text-foreground-500">
            Nominal amounts per minute for one machine. Ingredients distinguish recipe variants.
          </p>
          <Listbox
            aria-label="Compatible recipes"
            items={filtered}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={building.recipeId ? [building.recipeId] : []}
            emptyContent="No matching recipes"
            className="max-h-80 overflow-y-auto"
          >
            {(recipe) => {
              const name = itemNameById.get(recipe.output.id) ?? recipe.output.id
              const inputs = amounts(recipe.inputs)
              return (
                <ListboxItem
                  key={recipe.id}
                  textValue={`${name} ${recipe.output.amount_per_minute}/min; inputs: ${inputs}`}
                  onPress={() => onChoose(recipe.id)}
                  startContent={<AssetImage kind="items" id={recipe.output.id} width={32} alt="" />}
                  classNames={{ title: 'whitespace-normal', description: 'whitespace-normal' }}
                  description={
                    <>
                      <span className="block">Inputs: {inputs || 'None'}</span>
                      {!!recipe.extra_outputs?.length && <span className="block">Coproducts: {amounts(recipe.extra_outputs)}</span>}
                    </>
                  }
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span>{name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-foreground-500">{recipe.output.amount_per_minute}/min</span>
                  </span>
                </ListboxItem>
              )
            }}
          </Listbox>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
