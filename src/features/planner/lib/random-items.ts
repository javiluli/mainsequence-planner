import type { Item } from '@/shared/@types/item.type'

/** Returns a shuffled subset for the decorative Planner marquee. */
export const getRandomItemIds = (items: readonly Item[], count: number) => {
  const shuffledIds = items.map((item) => item.id)

  for (let index = shuffledIds.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffledIds[index], shuffledIds[randomIndex]] = [shuffledIds[randomIndex], shuffledIds[index]]
  }

  return shuffledIds.slice(0, Math.max(0, count))
}
