import { Button, Select, SelectItem } from '@heroui/react'
import { Plus, X } from 'lucide-react'
import { useState, type Ref } from 'react'
import { itemById, itemNameById } from '@/shared/data'
import { AssetImage } from '@/shared/ui/asset-image'
import { recipeForPlaceable, recipeLabel, recipeOutputs, recipesForPlaceable } from '../lib/machine-recipes'
import type { BasePlacement } from '../lib/placement'
import { PLACEABLES } from '../model/catalog'
import { ItemPickerModal } from './item-picker-modal'
import type { MachinePortState } from '../lib/connections'
import type { MachinePort } from '../lib/ports'
import { MachinePortsPanel } from './machine-ports-panel'

interface MachineRecipePanelProps {
  ref?: Ref<HTMLElement>
  onClose: () => void
  placement: BasePlacement
  onAssign: (recipeId: string | null) => void
  onAssignInputItem: (itemId: string | null) => void
  ports: readonly MachinePortState[]
  onToggleOutput: (port: MachinePort) => void
}

export function MachineRecipePanel({
  ref,
  onClose,
  placement,
  onAssign,
  onAssignInputItem,
  ports,
  onToggleOutput,
}: MachineRecipePanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const recipes = recipesForPlaceable(placement.type).filter((recipe) => recipe.id)
  const selected = recipeForPlaceable(placement.type, placement.recipeId)
  const outputs = selected ? recipeOutputs(selected) : []
  const inputItems =
    selected?.inputs
      .flatMap((input) => {
        const item = itemById.get(input.id)
        return item ? [item] : []
      })
      .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index) ?? []
  const markedItem = inputItems.find((item) => item.id === placement.inputItemId)

  return (
    <>
      <aside
        ref={ref}
        tabIndex={-1}
        aria-label={`${PLACEABLES[placement.type].label} inspector`}
        id="base-machine-inspector"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented) {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          }
        }}
        className="base-recipe-panel nodrag nopan min-h-0 flex-1 overflow-y-auto overscroll-contain bg-content1 p-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
      >
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold">{PLACEABLES[placement.type].label}</h3>
          <Button isIconOnly size="sm" variant="light" aria-label="Close machine inspector" onPress={onClose}>
            <X size={14} aria-hidden />
          </Button>
        </div>
        {recipes.length ? (
          <>
            <Select
              aria-label={`Recipe for ${PLACEABLES[placement.type].label}`}
              label="Recipe"
              labelPlacement="outside"
              placeholder="Choose a recipe"
              size="sm"
              selectedKeys={placement.recipeId ? [placement.recipeId] : []}
              onSelectionChange={(keys) => {
                const recipeId = keys === 'all' ? null : [...keys][0]
                onAssign(recipeId ? String(recipeId) : null)
              }}
              classNames={{ trigger: 'rounded-sm border border-divider bg-content2 shadow-none' }}
            >
              {recipes.map((recipe) => (
                <SelectItem key={recipe.id}>{recipeLabel(recipe)}</SelectItem>
              ))}
            </Select>
            {selected ? (
              <div className="mt-3 grid gap-2 text-xs">
                <div>
                  <span className="text-foreground/70">Recipe inputs</span>
                  <p className="mt-0.5 text-foreground">
                    {selected.inputs.map((item) => itemNameById.get(item.id) ?? item.id).join(' · ') || 'None'}
                  </p>
                </div>
                <div>
                  <span className="text-foreground/70">Recipe products</span>
                  <div className="mt-1 grid gap-1">
                    {outputs.map((item, index) => (
                      <div key={`${item.id}:${index}`} className="flex min-w-0 items-center gap-1.5 text-foreground">
                        <AssetImage kind="items" id={item.id} width={18} alt="" />
                        <span className="min-w-0 flex-1 truncate" title={itemNameById.get(item.id) ?? item.id}>
                          {itemNameById.get(item.id) ?? item.id}
                        </span>
                        <span className="shrink-0 text-[10px] text-foreground/55">{index === 0 ? 'Primary' : 'Co-product'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-foreground/70">
                  On the canvas: products above the name; optional input marker below. No item flow is simulated.
                </p>
                {inputItems.length ? (
                  <Button
                    variant="flat"
                    size="sm"
                    className="mt-1 min-w-0 justify-start gap-2 rounded-sm border border-divider bg-content2 text-xs"
                    onPress={() => setPickerOpen(true)}
                    startContent={
                      markedItem ? <AssetImage kind="items" id={markedItem.id} width={22} alt="" /> : <Plus size={14} aria-hidden />
                    }
                  >
                    <span className="truncate">{markedItem ? `Input marker · ${markedItem.name}` : 'Mark an input item on machine'}</span>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-foreground/65">No recipe data for this structure in the current game catalog.</p>
        )}
        <MachinePortsPanel machineName={PLACEABLES[placement.type].label} ports={ports} onToggleOutput={onToggleOutput} />
      </aside>
      <ItemPickerModal
        open={pickerOpen && inputItems.length > 0}
        onOpenChange={setPickerOpen}
        closeOnSelect
        title="Machine input marker"
        description="Choose one input from this machine’s assigned recipe. This marker is visual only; it does not change production or route items."
        items={inputItems}
        selectedItemId={markedItem?.id ?? null}
        onSelect={onAssignInputItem}
      />
    </>
  )
}
