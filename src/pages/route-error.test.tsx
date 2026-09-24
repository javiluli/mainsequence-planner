/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { RouteError } from './route-error'

const renderRejectedRoute = (error: unknown) => {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        errorElement: <RouteError />,
        children: [
          {
            path: 'rejected',
            loader: () => {
              throw error
            },
            element: <div />,
          },
        ],
      },
    ],
    { initialEntries: ['/rejected'] },
  )

  render(<RouterProvider router={router} />)
}

afterEach(cleanup)

describe('RouteError', () => {
  it('renders a real 404 with its own recovery action', async () => {
    renderRejectedRoute(new Response('Not found', { status: 404, statusText: 'Not Found' }))

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Back to Planner' })).toBeVisible()
  })

  it('does not disguise an unexpected failure as a 404', async () => {
    renderRejectedRoute(new Error('Broken route fixture'))

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument()
  })
})
