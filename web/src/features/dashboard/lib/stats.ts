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
  DashboardUsageStats,
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

function emptyUsageStats(id: string, name: string): DashboardUsageStats {
  return {
    id,
    name,
    requestCount: 0,
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    cacheReadTokens: 0,
    inputCacheHitRate: 0,
    failedCount: 0,
    successRate: 0,
  }
}

function finalizeUsageStats(
  rows: Map<string, DashboardUsageStats>
): DashboardUsageStats[] {
  return [...rows.values()]
    .map((row) => ({
      ...row,
      inputCacheHitRate:
        safeDivide(row.cacheReadTokens, row.promptTokens) * 100,
      successRate:
        safeDivide(row.requestCount, row.requestCount + row.failedCount) * 100,
    }))
    .sort(
      (a, b) =>
        b.totalTokens - a.totalTokens ||
        b.requestCount - a.requestCount ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)
    )
}

export function calculateModelUsageStats(
  data: QuotaDataItem[],
  logStats?: DashboardLogStats
): DashboardUsageStats[] {
  const rows = new Map<string, DashboardUsageStats>()

  for (const item of data) {
    const modelName = item.model_name || ''
    const cacheRead = Number(item.cache_read_tokens) || 0
    const current = rows.get(modelName) ?? emptyUsageStats(modelName, modelName)
    current.requestCount += Number(item.count) || 0
    current.totalTokens += Number(item.token_used) || 0
    current.cacheReadTokens += Number.isFinite(cacheRead)
      ? Math.max(0, cacheRead)
      : 0
    rows.set(modelName, current)
  }

  for (const model of logStats?.models ?? []) {
    const current =
      rows.get(model.model_name) ??
      emptyUsageStats(model.model_name, model.model_name)
    current.promptTokens = Number(model.prompt_tokens) || 0
    current.completionTokens = Number(model.completion_tokens) || 0
    current.failedCount = Number(model.failed_count) || 0
    if (!current.totalTokens) {
      current.totalTokens = current.promptTokens + current.completionTokens
    }
    rows.set(model.model_name, current)
  }

  return finalizeUsageStats(rows)
}

export function calculateKeyUsageStats(
  logStats?: DashboardLogStats
): DashboardUsageStats[] {
  const rows = new Map<string, DashboardUsageStats>()

  for (const token of logStats?.token_quota ?? []) {
    const id = String(token.token_id)
    const cacheRead = Number(token.cache_read_tokens) || 0
    const current = emptyUsageStats(id, '')
    current.requestCount = Number(token.request_count) || 0
    current.totalTokens = Number(token.total_tokens) || 0
    current.cacheReadTokens = Number.isFinite(cacheRead)
      ? Math.max(0, cacheRead)
      : 0
    rows.set(id, current)
  }

  for (const token of logStats?.tokens ?? []) {
    const id = String(token.token_id)
    const current = rows.get(id) ?? emptyUsageStats(id, '')
    current.name = token.token_name || ''
    current.promptTokens = Number(token.prompt_tokens) || 0
    current.completionTokens = Number(token.completion_tokens) || 0
    current.failedCount = Number(token.failed_count) || 0
    if (!current.totalTokens) {
      current.totalTokens = current.promptTokens + current.completionTokens
    }
    rows.set(id, current)
  }

  return finalizeUsageStats(rows)
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
