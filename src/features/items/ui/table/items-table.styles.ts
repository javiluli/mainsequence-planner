/** Native table styles aligned with HeroUI; column widths and spacer rows support TanStack Virtual. */
export const itemsTableStyles = {
  base: 'flex h-full min-h-0 w-full flex-col gap-4 overflow-auto relative',
  table: 'h-auto w-full min-w-[760px] md:min-w-4xl table-fixed border-separate border-spacing-0',
  head: [
    '[&>tr]:first:rounded-sm',
    "after:content-[''] after:table-row after:h-[5px]",
    'sticky top-0 z-20 border-b border-divider/70',
    'bg-content1/60',
  ].join(' '),
  body: 'after:block',
  row: 'surface-hover border-b border-divider/60',
  headerCell: [
    'h-10 px-3',
    'text-start align-middle whitespace-nowrap',
    'bg-content2/70 text-tiny font-semibold text-foreground-500',
    'first:rounded-s-sm last:rounded-e-sm',
    'uppercase text-foreground/50',
  ].join(' '),
  cell: ['relative min-w-0 px-3 py-2', 'align-middle whitespace-normal text-small font-normal', '[&>*]:relative [&>*]:z-1'].join(' '),
} as const
