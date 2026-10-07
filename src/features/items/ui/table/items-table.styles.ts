/**
 * Estilos base equivalentes a los slots de Table de HeroUI v2.
 *
 * La tabla usa elementos HTML nativos para poder integrarse con TanStack
 * Virtual, por lo que estos estilos mantienen su aspecto alineado con HeroUI.
 * Las clases marcadas como adaptacion pertenecen al layout virtual de Items.
 */
export const itemsTableStyles = {
  base: 'flex h-full min-h-0 w-full flex-col gap-4 overflow-auto relative',
  table: 'h-auto w-full min-w-[760px] md:min-w-4xl table-fixed border-separate border-spacing-0',
  head: [
    '[&>tr]:first:rounded-sm',
    "after:content-[''] after:table-row after:h-[5px]",
    'sticky top-0 z-20 border-b border-divider/70',
    // Adaptacion: conserva el tono aplicado al encabezado de Items.
    'bg-content1/60',
  ].join(' '),
  body: 'after:block',
  row: [
    'group/tr outline-solid outline-transparent',
    'data-[focus-visible=true]:z-10',
    'data-[focus-visible=true]:outline-2',
    'data-[focus-visible=true]:outline-focus',
    'data-[focus-visible=true]:outline-offset-2',
    // Adaptacion: feedback visual ya usado por las tablas del proyecto.
    'border-b border-divider/60 transition-colors hover:bg-content1/30',
  ].join(' '),
  headerCell: [
    'group/th h-10 px-3',
    'text-start align-middle whitespace-nowrap',
    'bg-content2/70 text-tiny font-semibold text-foreground-500',
    'first:rounded-s-sm last:rounded-e-sm',
    'outline-solid outline-transparent',
    'data-[sortable=true]:cursor-pointer data-[hover=true]:text-foreground-400',
    'data-[focus-visible=true]:z-10',
    'data-[focus-visible=true]:outline-2',
    'data-[focus-visible=true]:outline-focus',
    'data-[focus-visible=true]:outline-offset-2',
    // Adaptacion: los encabezados de la aplicacion se muestran en mayusculas.
    'uppercase text-foreground/50',
  ].join(' '),
  cell: [
    'relative min-w-0 px-3 py-2',
    'align-middle whitespace-normal text-small font-normal',
    'outline-solid outline-transparent',
    '[&>*]:relative [&>*]:z-1',
    'data-[focus-visible=true]:z-10',
    'data-[focus-visible=true]:outline-2',
    'data-[focus-visible=true]:outline-focus',
    'data-[focus-visible=true]:outline-offset-2',
    'before:pointer-events-none before:absolute before:inset-0 before:z-0',
    "before:content-[''] before:bg-default/60 before:opacity-0",
    'data-[selected=true]:text-default-foreground',
    'data-[selected=true]:before:opacity-100',
    'first:before:rounded-s-sm last:before:rounded-e-sm',
    'group-data-[disabled=true]/tr:cursor-not-allowed',
    'group-data-[disabled=true]/tr:text-foreground-300',
  ].join(' '),
  emptyCell: 'h-40 px-3 text-center align-middle text-small text-foreground-400',
} as const
