import { useProductionPlan } from '@/features/planner/hooks/use-production-plan'
import { itemById } from '@/shared/data'

/** Only invalid rates and cycles block calculation; missing recipes become external inputs. */
export function NoProductionRoute() {
  const plan = useProductionPlan()
  if (!plan) return null

  const targetName = itemById.get(plan.targetId)?.name ?? plan.targetId

  return (
    <div className="h-full overflow-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl rounded-md border border-danger/50 bg-danger/10 p-4">
        <h2 className="font-semibold">Cannot calculate {targetName}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/80">
          {plan.issues.map((issue) => (
            <li key={`${issue.code}:${issue.itemId}`}>{issue.message}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
