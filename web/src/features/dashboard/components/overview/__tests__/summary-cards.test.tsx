/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { SummaryCards } from '../summary-cards'

let client: QueryClient

beforeEach(() => {
  window.localStorage.clear()
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'dashboard-user',
    role: 1,
    quota: 1000000,
    used_quota: 1000,
    request_count: 7,
  })
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    switch (url) {
      case '/api/status':
        return { data: { success: true, data: {} } }
      case '/api/data/self':
        return {
          data: {
            success: true,
            data: [
              { created_at: 1000, token_used: 1200, quota: 100 },
              { created_at: 2000, token_used: 300, quota: 50 },
            ],
          },
        }
      case '/api/data/self/total':
        return { data: { success: true, data: { total_tokens: 9876 } } }
      default:
        throw new Error(`Unexpected summary request: ${url}`)
    }
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  window.localStorage.clear()
})

it('shows recent and historical usage as total tokens instead of currency', async () => {
  const router = createRouter({
    routeTree: createRootRoute({ component: SummaryCards }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )

  expect(await screen.findAllByText('1,500')).toHaveLength(2)
  expect(await screen.findByText('9,876')).toBeVisible()
  expect(screen.getAllByText('Total Tokens')).toHaveLength(2)
  expect(screen.queryByText(/\(USD\)/)).not.toBeInTheDocument()
})
