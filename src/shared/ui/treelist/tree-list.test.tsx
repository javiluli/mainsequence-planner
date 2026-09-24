/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TreeListNode } from './tree-list-node'
import { TreeList } from './tree-list'

interface TestNode {
  id: string
  label: string
  children?: TestNode[]
}

const data: TestNode[] = [
  {
    id: 'root',
    label: 'Root process',
    children: [{ id: 'child', label: 'Input material' }],
  },
]

afterEach(cleanup)

describe('TreeList disclosure semantics', () => {
  it('uses nested lists and a native button to expose expansion state', () => {
    render(
      <TreeList data={data}>
        {({ node, hasChildren, isExpanded, toggle }) => (
          <TreeListNode hasChildren={hasChildren} isExpanded={isExpanded} toggle={toggle}>
            {node.label}
          </TreeListNode>
        )}
      </TreeList>,
    )

    const rootButton = screen.getByRole('button', { name: 'Root process' })
    expect(rootButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('list')).toHaveLength(2)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Input material')).toBeVisible()

    fireEvent.click(rootButton)

    expect(rootButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Input material')).not.toBeInTheDocument()
  })
})
