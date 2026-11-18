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
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Dashboard } from '@/features/dashboard'
import { useAuthStore } from '@/stores/auth-store'

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({ useParams: () => ({ section: 'keys' }) }),
  useNavigate: () => vi.fn(),
}))
vi.mock(
  '@/features/dashboard/components/models/models-chart-preferences',
  () => ({ ModelsChartPreferences: () => null })
)
vi.mock('@/features/dashboard/components/models/models-filter-dialog', () => ({
  ModelsFilter: () => null,
}))
vi.mock('@/features/dashboard/components/models/log-stat-cards', () => ({
  LogStatCards: () => null,
}))
vi.mock('@/features/dashboard/components/usage-ranking-table', () => ({
  UsageRankingTable: () => null,
}))

const originalAuth = useAuthStore.getState().auth

afterEach(() => {
  useAuthStore.setState({ auth: originalAuth })
})

describe('dashboard section layout', () => {
  it('keeps horizontal tab scrolling without a vertical scrollbar', () => {
    useAuthStore.setState({
      auth: {
        ...originalAuth,
        user: { id: 1, username: 'user', role: 1 },
      },
    })

    render(<Dashboard />)

    const tabs = screen.getByRole('tablist')
    expect(tabs).toHaveClass('overflow-x-auto', 'overflow-y-hidden')
    expect(
      screen.getByRole('tab', { name: 'Client Key Statistics' })
    ).toBeVisible()
  })
})
