const buildingCostFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
})

/** Keeps construction quantities readable while retaining non-integer source values if they are added later. */
export const formatBuildingCostAmount = (amount: number) => buildingCostFormatter.format(amount)
