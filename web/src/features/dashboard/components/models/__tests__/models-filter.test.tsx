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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { ModelsFilter } from '@/features/dashboard/components/models/models-filter-dialog'
import { DEFAULT_DASHBOARD_CHART_PREFERENCES } from '@/features/dashboard/constants'
import {
  buildDefaultDashboardFilters,
  buildQueryParams,
} from '@/features/dashboard/lib'
import { getApiKeys } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import { useAuthStore } from '@/stores/auth-store'

vi.mock('@/features/keys/api', () => ({ getApiKeys: vi.fn() }))

const mockedGetApiKeys = vi.mocked(getApiKeys)
const originalAuth = useAuthStore.getState().auth
// jsdom lacks the Web Animations API the dialog's scroll area waits on.
const getAnimationsDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'getAnimations'
)

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
})

afterAll(() => {
  if (getAnimationsDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'getAnimations',
      getAnimationsDescriptor
    )
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
  }
})

function apiKey(id: number, name: string): ApiKey {
  return {
    id,
    name,
    key: `key-${id}`,
    status: 1,
    remain_quota: 0,
    used_quota: 0,
    unlimited_quota: true,
    expired_time: -1,
    created_time: 1,
    accessed_time: 1,
    group: '',
    auto_groups: null,
    cross_group_retry: false,
    model_limits_enabled: false,
    model_limits: '',
    allow_ips: '',
    allow_user_quota_query: false,
  }
}

function renderFilter(onFilterChange = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <ModelsFilter
        preferences={DEFAULT_DASHBOARD_CHART_PREFERENCES}
        currentFilters={buildDefaultDashboardFilters(
          DEFAULT_DASHBOARD_CHART_PREFERENCES
        )}
        onFilterChange={onFilterChange}
        onReset={vi.fn()}
      />
    </QueryClientProvider>
  )
  return onFilterChange
}

describe('model analytics API key filter', () => {
  beforeEach(() => {
    useAuthStore.setState({
      auth: {
        ...originalAuth,
        user: { id: 1, username: 'admin', role: 10 },
      },
    })
  })

  afterEach(() => {
    mockedGetApiKeys.mockReset()
    useAuthStore.setState({ auth: originalAuth })
  })

  it('loads every key page and applies the selected token ID', async () => {
    mockedGetApiKeys.mockImplementation(({ p = 1 } = {}) =>
      Promise.resolve({
        success: true,
        data: {
          items:
            p === 1
              ? Array.from({ length: 100 }, (_, index) =>
                  apiKey(index + 1, `Key ${index + 1}`)
                )
              : [apiKey(101, 'Page two key')],
          total: 101,
          page: p,
          page_size: 100,
        },
      })
    )
    const onFilterChange = renderFilter()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const keyFilter = await screen.findByRole('combobox', { name: 'API Key' })
    await waitFor(() => expect(keyFilter).toBeEnabled())
    await user.click(keyFilter)
    await user.click(
      await screen.findByRole('option', { name: /Page two key/ })
    )
    await user.click(screen.getByRole('button', { name: 'Apply Filters' }))

    expect(mockedGetApiKeys).toHaveBeenCalledTimes(2)
    expect(mockedGetApiKeys).toHaveBeenNthCalledWith(2, { p: 2, size: 100 })
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ token_id: 101 })
    )
  })

  it('adds the selected token ID to dashboard query parameters', () => {
    expect(
      buildQueryParams(
        { start_timestamp: 100, end_timestamp: 200 },
        { time_granularity: 'hour', token_id: 101 }
      )
    ).toEqual({
      start_timestamp: 100,
      end_timestamp: 200,
      default_time: 'hour',
      token_id: 101,
    })
  })
})
