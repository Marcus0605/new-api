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
import type {
  DashboardLogStats,
  DashboardModelUsage,
  QuotaDataItem,
} from '@/features/dashboard/types'

/**
 * Safe division: handles NaN and Infinity cases
 */
export function safeDivide(
  value: number,
  divisor: number,
  precision: number = 3
): number {
  const result = value / divisor
  if (Number.isNaN(result) || !Number.isFinite(result)) return 0
  const factor = Math.pow(10, precision)
  return Math.round(result * factor) / factor
}

/**
 * Aggregate request, token, and cache usage for each model.
 */
export function calculateModelUsageStats(
  data: QuotaDataItem[],
  logStats?: DashboardLogStats
): DashboardModelUsage[] {
  const rows = new Map<string, DashboardModelUsage>()

  for (const item of data) {
    const modelName = item.model_name || ''
    const cacheRead = Number(item.cache_read_tokens) || 0
    const current = rows.get(modelName) ?? {
      modelName,
      requestCount: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      cacheReadTokens: 0,
      inputCacheHitRate: 0,
    }
    current.requestCount += Number(item.count) || 0
    current.totalTokens += Number(item.token_used) || 0
    current.cacheReadTokens += Number.isFinite(cacheRead)
      ? Math.max(0, cacheRead)
      : 0
    rows.set(modelName, current)
  }

  for (const model of logStats?.models ?? []) {
    const current = rows.get(model.model_name) ?? {
      modelName: model.model_name,
      requestCount: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      cacheReadTokens: 0,
      inputCacheHitRate: 0,
    }
    current.promptTokens = Number(model.prompt_tokens) || 0
    current.completionTokens = Number(model.completion_tokens) || 0
    rows.set(model.model_name, current)
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      inputCacheHitRate:
        safeDivide(row.cacheReadTokens, row.promptTokens) * 100,
    }))
    .sort(
      (a, b) =>
        b.totalTokens - a.totalTokens ||
        b.requestCount - a.requestCount ||
        a.modelName.localeCompare(b.modelName)
    )
}

/**
 * Calculate aggregated statistics from quota data
 */
export function calculateDashboardStats(
  data: QuotaDataItem[],
  logStats?: DashboardLogStats
) {
  const totals = data.reduce(
    (acc, item) => {
      const cacheRead = item.cache_read_tokens ?? 0
      return {
        totalCount: acc.totalCount + (Number(item.count) || 0),
        totalTokens: acc.totalTokens + (Number(item.token_used) || 0),
        totalCacheReadTokens:
          acc.totalCacheReadTokens +
          (Number.isFinite(cacheRead) ? Math.max(0, cacheRead) : 0),
      }
    },
    {
      totalCount: 0,
      totalTokens: 0,
      totalCacheReadTokens: 0,
    }
  )
  const totalPromptTokens = Number(logStats?.prompt_tokens) || 0
  const totalCompletionTokens = Number(logStats?.completion_tokens) || 0

  return {
    ...totals,
    totalPromptTokens,
    totalCompletionTokens,
    inputCacheHitRate:
      safeDivide(totals.totalCacheReadTokens, totalPromptTokens) * 100,
  }
}
