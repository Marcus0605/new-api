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

import { ModelUsageTable } from '@/features/dashboard/components/models/model-usage-table'

describe('model usage table', () => {
  it('ranks models in an accessible scroll region without cost columns', () => {
    render(
      <ModelUsageTable
        loading={false}
        data={[
          {
            created_at: 100,
            model_name: 'gpt-b',
            token_used: 20,
            count: 2,
            cache_read_tokens: 10,
          },
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
            { model_name: 'gpt-a', prompt_tokens: 10, completion_tokens: 90 },
            { model_name: 'gpt-b', prompt_tokens: 10, completion_tokens: 10 },
          ],
        }}
      />
    )

    const region = screen.getByRole('region', {
      name: 'Model Consumption Ranking',
    })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(within(region).getByText('Total Tokens')).toBeVisible()
    expect(within(region).getByText('Input Cache Hit Rate')).toBeVisible()
    expect(within(region).queryByText(/cost/i)).not.toBeInTheDocument()
    expect(within(region).queryByText(/quota/i)).not.toBeInTheDocument()

    const rows = within(region).getAllByRole('row')
    expect(within(rows[1]).getByText('gpt-a')).toBeVisible()
    expect(within(rows[1]).getAllByRole('cell')[2]).toHaveTextContent('1')
    expect(within(rows[2]).getByText('gpt-b')).toBeVisible()
  })
})
