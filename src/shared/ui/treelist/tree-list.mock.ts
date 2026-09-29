export interface TreeListMockNode {
  id: string
  label: string
  description?: string
  category?: string
  stats?: Array<{ label: string; value: string }>
  children?: TreeListMockNode[]
}

export const treeListMockData: TreeListMockNode[] = [
  {
    id: 'production',
    label: 'Production Chain',
    description: 'Main factory line grouped by building type.',
    category: 'root',
    stats: [
      { label: 'Buildings', value: '4' },
      { label: 'Items/min', value: '240' },
    ],
    children: [
      {
        id: 'smelter',
        label: 'Smelter',
        description: 'Transforms raw ore into usable ingots.',
        category: 'building',
        stats: [{ label: 'Energy', value: '5 MJ' }],
        children: [
          {
            id: 'titanium-bar',
            label: 'Titanium Bar',
            description: 'Output item used by later fabrication steps.',
            category: 'item',
            stats: [{ label: 'Rate', value: '60/m' }],
          },
          {
            id: 'wolfram-bar',
            label: 'Wolfram Bar',
            description: 'Secondary processed material.',
            category: 'item',
            stats: [{ label: 'Rate', value: '30/m' }],
          },
        ],
      },
      {
        id: 'fabricator',
        label: 'Fabricator',
        description: 'Assembles intermediate parts from processed materials.',
        category: 'building',
        stats: [{ label: 'Energy', value: '10 MJ' }],
        children: [
          {
            id: 'stator',
            label: 'Stator',
            description: 'Advanced component for late-game logistics.',
            category: 'item',
            stats: [{ label: 'Rate', value: '20/m' }],
          },
        ],
      },
    ],
  },
  {
    id: 'logistics',
    label: 'Logistics Group',
    description: 'A separate branch to prove multiple roots work.',
    category: 'root',
    stats: [{ label: 'Routes', value: '2' }],
    children: [
      {
        id: 'external-supply',
        label: 'External Supply',
        description: 'Warehouse or drone delivery source.',
        category: 'building',
        stats: [{ label: 'Rate', value: '10/m' }],
      },
    ],
  },
]
