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

import {
  calculateDashboardStats,
  calculateKeyUsageStats,
  calculateModelUsageStats,
} from '../stats'

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
          {
            model_name: 'gpt-a',
            prompt_tokens: 10,
            completion_tokens: 90,
            failed_count: 1,
          },
          {
            model_name: 'gpt-b',
            prompt_tokens: 100,
            completion_tokens: 10,
          },
          {
            model_name: 'gpt-c',
            prompt_tokens: 0,
            completion_tokens: 2,
            failed_count: 1,
          },
        ],
      }
    )

    expect(result).toEqual([
      {
        id: 'gpt-a',
        name: 'gpt-a',
        requestCount: 1,
        totalTokens: 100,
        promptTokens: 10,
        completionTokens: 90,
        cacheReadTokens: 5,
        inputCacheHitRate: 50,
        failedCount: 1,
        successRate: 50,
      },
      {
        id: 'gpt-b',
        name: 'gpt-b',
        requestCount: 5,
        totalTokens: 50,
        promptTokens: 100,
        completionTokens: 10,
        cacheReadTokens: 50,
        inputCacheHitRate: 50,
        failedCount: 0,
        successRate: 100,
      },
      {
        id: 'gpt-c',
        name: 'gpt-c',
        requestCount: 0,
        totalTokens: 2,
        promptTokens: 0,
        completionTokens: 2,
        cacheReadTokens: 0,
        inputCacheHitRate: 0,
        failedCount: 1,
        successRate: 0,
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

describe('dashboard client key statistics', () => {
  test('merges same-named keys by ID and calculates success rates', () => {
    const result = calculateKeyUsageStats({
      token_quota: [
        {
          token_id: 11,
          request_count: 3,
          total_tokens: 300,
          cache_read_tokens: 50,
        },
        { token_id: 22, request_count: 0, total_tokens: 0 },
        {
          token_id: 33,
          request_count: 2,
          total_tokens: 20,
          cache_read_tokens: 0,
        },
      ],
      tokens: [
        {
          token_id: 11,
          token_name: 'shared',
          prompt_tokens: 100,
          completion_tokens: 200,
          failed_count: 1,
        },
        { token_id: 22, token_name: 'shared', failed_count: 2 },
        {
          token_id: 33,
          token_name: '',
          prompt_tokens: 10,
          completion_tokens: 10,
        },
      ],
    })

    expect(result).toEqual([
      {
        id: '11',
        name: 'shared',
        requestCount: 3,
        totalTokens: 300,
        promptTokens: 100,
        completionTokens: 200,
        cacheReadTokens: 50,
        inputCacheHitRate: 50,
        failedCount: 1,
        successRate: 75,
      },
      {
        id: '33',
        name: '',
        requestCount: 2,
        totalTokens: 20,
        promptTokens: 10,
        completionTokens: 10,
        cacheReadTokens: 0,
        inputCacheHitRate: 0,
        failedCount: 0,
        successRate: 100,
      },
      {
        id: '22',
        name: 'shared',
        requestCount: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        cacheReadTokens: 0,
        inputCacheHitRate: 0,
        failedCount: 2,
        successRate: 0,
      },
    ])
  })

  test('returns zero success rate when a key has no requests', () => {
    const result = calculateKeyUsageStats({
      token_quota: [{ token_id: 44, request_count: 0, total_tokens: 0 }],
    })

    expect(result[0].successRate).toBe(0)
    expect(result[0].inputCacheHitRate).toBe(0)
  })
})
