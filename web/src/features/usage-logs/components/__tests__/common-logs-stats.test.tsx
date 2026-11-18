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
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { CommonLogsStats } from '../common-logs-stats'
import { UsageLogsProvider } from '../usage-logs-provider'

function StatsFixture() {
  return (
    <UsageLogsProvider>
      <CommonLogsStats />
    </UsageLogsProvider>
  )
}

async function renderStats(data: Record<string, number>) {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data },
  })
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const logs = createRoute({
    getParentRoute: () => auth,
    path: '/usage-logs/$section',
    component: StatsFixture,
    validateSearch: (search: Record<string, unknown>) => search,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([logs])]),
    history: createMemoryHistory({
      initialEntries: ['/usage-logs/common'],
    }),
  })
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  await screen.findByText('Usage')
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('shows aggregate token, input cache, and duration metrics for the selected logs', async () => {
  await renderStats({
    quota: 0,
    rpm: 2,
    tpm: 3,
    prompt_tokens: 1200,
    completion_tokens: 300,
    cache_read_tokens: 300,
    average_use_time: 12.5,
  })

  expect(screen.getByText('Total Tokens').parentElement).toHaveTextContent(
    '1.5K'
  )
  expect(screen.getByText('Total Input').parentElement).toHaveTextContent(
    '1.2K'
  )
  expect(screen.getByText('Total Output').parentElement).toHaveTextContent(
    '300'
  )
  expect(screen.getByText('Total Input Cache').parentElement).toHaveTextContent(
    '300'
  )
  expect(
    screen.getByText('Average Input Cache Hit Rate').parentElement
  ).toHaveTextContent('25%')
  expect(screen.getByText('Average Duration').parentElement).toHaveTextContent(
    '12.5s'
  )
})

it('shows zero cache rate and duration when the selected range has no input', async () => {
  await renderStats({
    quota: 0,
    rpm: 0,
    tpm: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    cache_read_tokens: 0,
    average_use_time: 0,
  })

  expect(
    screen.getByText('Average Input Cache Hit Rate').parentElement
  ).toHaveTextContent('0%')
  expect(screen.getByText('Average Duration').parentElement).toHaveTextContent(
    '0.0s'
  )
})
