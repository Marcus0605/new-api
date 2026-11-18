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

import { calculateDashboardStats, calculateModelUsageStats } from '../stats'

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

  test('aggregates and ranks per-model token usage without cost metrics', () => {
    const result = calculateModelUsageStats(
      [
        {
          created_at: 100,
          model_name: 'gpt-b',
          token_used: 20,
          count: 2,
          cache_read_tokens: 25,
        },
        {
          created_at: 200,
          model_name: 'gpt-b',
          token_used: 30,
          count: 3,
          cache_read_tokens: 25,
        },
        {
          created_at: 100,
          model_name: 'gpt-a',
          token_used: 100,
          count: 1,
          cache_read_tokens: 5,
        },
      ],
      {
        models: [
          { model_name: 'gpt-a', prompt_tokens: 10, completion_tokens: 90 },
          { model_name: 'gpt-b', prompt_tokens: 100, completion_tokens: 10 },
          { model_name: 'gpt-c', prompt_tokens: 0, completion_tokens: 2 },
        ],
      }
    )

    expect(result).toEqual([
      {
        modelName: 'gpt-a',
        requestCount: 1,
        totalTokens: 100,
        promptTokens: 10,
        completionTokens: 90,
        cacheReadTokens: 5,
        inputCacheHitRate: 50,
      },
      {
        modelName: 'gpt-b',
        requestCount: 5,
        totalTokens: 50,
        promptTokens: 100,
        completionTokens: 10,
        cacheReadTokens: 50,
        inputCacheHitRate: 50,
      },
      {
        modelName: 'gpt-c',
        requestCount: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 2,
        cacheReadTokens: 0,
        inputCacheHitRate: 0,
      },
    ])
    expect(result[0]).not.toHaveProperty('quota')
    expect(result[0]).not.toHaveProperty('cost')
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
