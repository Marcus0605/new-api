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
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getUserLogStats, getUserQuotaDates } from '@/features/dashboard/api'
import { LogStatCards } from '@/features/dashboard/components/models/log-stat-cards'

vi.mock('@/features/dashboard/api', () => ({
  getUserLogStats: vi.fn(),
  getUserQuotaDates: vi.fn(),
}))

const mockedGetUserLogStats = vi.mocked(getUserLogStats)
const mockedGetUserQuotaDates = vi.mocked(getUserQuotaDates)

beforeEach(() => {
  mockedGetUserQuotaDates.mockResolvedValue({ success: true, data: [] })
  mockedGetUserLogStats.mockResolvedValue({ success: true, data: {} })
})

afterEach(() => {
  mockedGetUserLogStats.mockReset()
  mockedGetUserQuotaDates.mockReset()
})

describe('client key statistic cards', () => {
  it('shows request, distinct authorized model, and total key counts', async () => {
    mockedGetUserQuotaDates.mockResolvedValue({
      success: true,
      data: [
        {
          created_at: 100,
          token_used: 300,
          count: 2,
          cache_read_tokens: 75,
        },
      ],
    })
    mockedGetUserLogStats.mockResolvedValue({
      success: true,
      data: {
        prompt_tokens: 300,
        completion_tokens: 100,
        token_catalog: [
          {
            token_id: 11,
            token_name: 'first',
            authorized_models: ['gpt-a', 'gpt-b'],
          },
          {
            token_id: 22,
            token_name: 'second',
            authorized_models: ['gpt-a'],
          },
          {
            token_id: 33,
            token_name: 'unused',
            authorized_models: ['gpt-c'],
          },
        ],
      },
    })

    render(<LogStatCards variant='key' />)

    const requests = screen.getByRole('group', { name: 'Total Requests' })
    const models = screen.getByRole('group', { name: 'Authorized Models' })
    const keys = screen.getByRole('group', { name: 'Total Keys' })
    await waitFor(() => expect(requests).toHaveTextContent('2'))
    expect(models).toHaveTextContent('3')
    expect(keys).toHaveTextContent('3')
  })

  it('lays out client key cards in two rows of five', () => {
    render(<LogStatCards variant='key' />)

    const requests = screen.getByRole('group', { name: 'Total Requests' })
    expect(requests.parentElement).toHaveClass('lg:grid-cols-5')
    expect(requests.parentElement?.children).toHaveLength(10)
  })

  it('lays out model analytics cards in two rows of four', () => {
    render(<LogStatCards />)

    const requests = screen.getByRole('group', { name: 'Total Requests' })
    expect(requests.parentElement).toHaveClass('lg:grid-cols-4')
    expect(requests.parentElement?.children).toHaveLength(8)
  })
})
