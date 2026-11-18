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
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UsageRankingTable } from '@/features/dashboard/components/usage-ranking-table'

describe('usage ranking table', () => {
  it('shows model failures and success rate in an accessible scroll region', () => {
    render(
      <UsageRankingTable
        variant='model'
        loading={false}
        data={[
          {
            created_at: 100,
            model_name: 'gpt-a',
            token_used: 100,
            count: 1,
            cache_read_tokens: 5,
          },
        ]}
        logStats={{
          models: [
            {
              model_name: 'gpt-a',
              prompt_tokens: 10,
              completion_tokens: 90,
              failed_count: 1,
            },
          ],
        }}
      />
    )

    const region = screen.getByRole('region', {
      name: 'Model Consumption Ranking',
    })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(within(region).getByText('Failures')).toBeVisible()
    expect(within(region).getByText('Success rate')).toBeVisible()
    expect(within(region).queryByText(/cost/i)).not.toBeInTheDocument()
    expect(within(region).queryByText(/quota/i)).not.toBeInTheDocument()

    const rows = within(region).getAllByRole('row')
    const cells = within(rows[1]).getAllByRole('cell')
    expect(cells[1]).toHaveTextContent('gpt-a')
    expect(cells[8]).toHaveTextContent('1')
    expect(cells[9]).toHaveTextContent('50%')
  })

  it('keeps same-named API keys in separate rows with their own success rates', () => {
    render(
      <UsageRankingTable
        variant='key'
        loading={false}
        data={[]}
        logStats={{
          token_quota: [
            { token_id: 11, request_count: 3, total_tokens: 300 },
            { token_id: 22, request_count: 2, total_tokens: 20 },
          ],
          tokens: [
            {
              token_id: 11,
              token_name: 'shared',
              prompt_tokens: 100,
              completion_tokens: 200,
              failed_count: 1,
            },
            {
              token_id: 22,
              token_name: 'shared',
              prompt_tokens: 10,
              completion_tokens: 10,
            },
          ],
        }}
      />
    )

    const region = screen.getByRole('region', {
      name: 'Key Consumption Ranking',
    })
    expect(within(region).getByText('API Key')).toBeVisible()
    const rows = within(region).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByText('shared')).toBeVisible()
    expect(within(rows[2]).getByText('shared')).toBeVisible()
    expect(within(rows[1]).getAllByRole('cell')[9]).toHaveTextContent('75%')
    expect(within(rows[2]).getAllByRole('cell')[9]).toHaveTextContent('100%')
  })
})
