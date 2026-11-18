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
import { describe, expect, test } from 'vitest'

import { calculateDashboardStats } from '../stats'

describe('dashboard model statistics', () => {
  test('combines log token totals with cached input usage', () => {
    const result = calculateDashboardStats(
      [
        {
          created_at: 100,
          token_used: 150,
          count: 1,
          cache_read_tokens: 50,
        },
        {
          created_at: 200,
          token_used: 150,
          count: 1,
          cache_read_tokens: 25,
        },
      ],
      { prompt_tokens: 300, completion_tokens: 100 }
    )

    expect(result).toEqual({
      totalCount: 2,
      totalTokens: 300,
      totalCacheReadTokens: 75,
      totalPromptTokens: 300,
      totalCompletionTokens: 100,
      inputCacheHitRate: 25,
    })
  })

  test('returns a zero cache hit rate when there are no input tokens', () => {
    const result = calculateDashboardStats([], {
      prompt_tokens: 0,
      completion_tokens: 0,
    })

    expect(result.inputCacheHitRate).toBe(0)
    expect(result.totalPromptTokens).toBe(0)
    expect(result.totalCompletionTokens).toBe(0)
  })
})
