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

import type { QuotaDataItem } from '@/features/dashboard/types'
import type { TimeGranularity } from '@/lib/time'

import { processChartData, processUserChartData } from '../charts'

const cases: Array<{
  granularity: TimeGranularity
  start: string
  interval: number
  labels: string[]
}> = [
  {
    granularity: 'hour',
    start: '2025-12-31T20:00:00',
    interval: 3600,
    labels: [
      '12-31 20:00',
      '12-31 21:00',
      '12-31 22:00',
      '12-31 23:00',
      '01-01 00:00',
      '01-01 01:00',
      '01-01 02:00',
      '01-01 03:00',
    ],
  },
  {
    granularity: 'day',
    start: '2025-12-27T12:00:00',
    interval: 86400,
    labels: [
      '12-27',
      '12-28',
      '12-29',
      '12-30',
      '12-31',
      '01-01',
      '01-02',
      '01-03',
    ],
  },
  {
    granularity: 'week',
    start: '2025-11-29T12:00:00',
    interval: 604800,
    labels: [
      '11-29 - 12-05',
      '12-06 - 12-12',
      '12-13 - 12-19',
      '12-20 - 12-26',
      '12-27 - 01-02',
      '01-03 - 01-09',
      '01-10 - 01-16',
      '01-17 - 01-23',
    ],
  },
]

function unorderedUsage(start: string, interval: number): QuotaDataItem[] {
  const first = new Date(start).getTime() / 1000
  const rows = Array.from({ length: 8 }, (_, i) => ({
    created_at: first + i * interval,
    model_name: 'model-a',
    username: 'alice',
    quota: (i + 1) * 500000,
    token_used: (i + 1) * 1000,
    count: i + 1,
  }))
  // Same hour, or a second hourly record within the same day/week label.
  const duplicate = {
    ...rows[0],
    created_at: first + (interval === 3600 ? 0 : 3600),
    quota: 5000000,
    token_used: 10000,
    count: 10,
  }
  return [
    rows[7],
    rows[2],
    duplicate,
    rows[5],
    rows[0],
    rows[6],
    rows[1],
    rows[4],
    rows[3],
  ]
}

describe.each(cases)('dashboard $granularity chart chronology', (scenario) => {
  test('orders model buckets across New Year while aggregating repeated labels', () => {
    const data = unorderedUsage(scenario.start, scenario.interval)
    const original = structuredClone(data)
    const result = processChartData(data, scenario.granularity)

    for (const key of ['spec_line', 'spec_area', 'spec_model_line'] as const) {
      const values: Array<{ Time: string; rawTokens: number; Count: number }> =
        result[key].data[0].values
      expect(values.map((row) => row.Time)).toEqual(scenario.labels)
      expect(
        values.map((row) =>
          key === 'spec_model_line' ? row.Count : row.rawTokens / 1000
        )
      ).toEqual([11, 2, 3, 4, 5, 6, 7, 8])
    }
    expect(data).toEqual(original)
  })

  test('orders user buckets across New Year while aggregating repeated labels', () => {
    const data = unorderedUsage(scenario.start, scenario.interval)
    const original = structuredClone(data)
    const result = processUserChartData(data, scenario.granularity)
    const values: Array<{ Time: string; rawTokens: number }> =
      result.spec_user_trend.data[0].values

    expect(values.map((row) => row.Time)).toEqual(scenario.labels)
    expect(values.map((row) => row.rawTokens / 1000)).toEqual([
      11, 2, 3, 4, 5, 6, 7, 8,
    ])
    expect(data).toEqual(original)
  })

  test('keeps the existing seven padded model buckets in chronological order', () => {
    const data = [unorderedUsage(scenario.start, scenario.interval)[0]]
    const result = processChartData(data, scenario.granularity)

    for (const key of ['spec_line', 'spec_area', 'spec_model_line'] as const) {
      const values: Array<{ Time: string; rawTokens: number; Count: number }> =
        result[key].data[0].values
      expect(values.map((row) => row.Time)).toEqual(scenario.labels.slice(1))
      expect(
        values.map((row) =>
          key === 'spec_model_line' ? row.Count : row.rawTokens / 1000
        )
      ).toEqual([0, 0, 0, 0, 0, 0, 8])
    }
  })
})

describe('dashboard token distribution', () => {
  test('uses token totals rather than quota for values, tooltips, and the header', () => {
    const timestamp = new Date('2026-01-01T08:00:00').getTime() / 1000
    const result = processChartData(
      [
        {
          created_at: timestamp,
          model_name: 'model-a',
          quota: 9999999,
          token_used: 1200,
          count: 1,
        },
        {
          created_at: timestamp,
          model_name: 'model-a',
          quota: 2,
          token_used: 455,
          count: 1,
        },
        {
          created_at: timestamp,
          model_name: 'model-b',
          quota: 1,
          token_used: 345,
          count: 1,
        },
      ],
      'hour'
    )
    const lineValues = result.spec_line.data[0].values.filter(
      (row: { Usage: number }) => row.Usage > 0
    )
    const areaValues = result.spec_area.data[0].values.filter(
      (row: { Usage: number }) => row.Usage > 0
    )

    for (const values of [lineValues, areaValues]) {
      expect(values).toEqual([
        {
          Time: '01-01 08:00',
          Model: 'model-a',
          rawTokens: 1655,
          Usage: 1655,
          TimeSum: 2000,
        },
        {
          Time: '01-01 08:00',
          Model: 'model-b',
          rawTokens: 345,
          Usage: 345,
          TimeSum: 2000,
        },
      ])
    }
    expect(result.totalTokenDisplay).toBe('2,000')
    expect(
      result.spec_line.tooltip.mark.content[0].value({ rawTokens: 1655 })
    ).toBe('1,655')
    expect(
      result.spec_area.tooltip.mark.content[0].value({ rawTokens: 345 })
    ).toBe('345')
  })

  test('shows zero tokens when there is no usage data', () => {
    expect(processChartData([]).totalTokenDisplay).toBe('0')
  })
})

describe('dashboard user token consumption', () => {
  test('uses token totals for ranking, trends, labels, and tooltips', () => {
    const timestamp = new Date('2026-01-01T08:00:00').getTime() / 1000
    const result = processUserChartData(
      [
        {
          created_at: timestamp,
          username: 'alice',
          quota: 1,
          token_used: 1200,
        },
        {
          created_at: timestamp,
          username: 'bob',
          quota: 9999999,
          token_used: 345,
        },
        {
          created_at: timestamp,
          username: 'alice',
          quota: 2,
          token_used: 455,
        },
      ],
      'hour'
    )

    expect(result.spec_user_rank.xField).toBe('rawTokens')
    expect(result.spec_user_trend.yField).toBe('rawTokens')
    expect(result.spec_user_rank.data[0].values).toEqual([
      { User: 'alice', rawTokens: 1655, Usage: 1655 },
      { User: 'bob', rawTokens: 345, Usage: 345 },
    ])
    expect(result.spec_user_trend.data[0].values).toEqual([
      {
        Time: '01-01 08:00',
        User: 'alice',
        rawTokens: 1655,
        Usage: 1655,
      },
      {
        Time: '01-01 08:00',
        User: 'bob',
        rawTokens: 345,
        Usage: 345,
      },
    ])
    expect(result.spec_user_rank.title.subtext).toBe('Total: 2,000')
    expect(result.spec_user_trend.title.subtext).toBe('Total: 2,000')
    expect(result.spec_user_rank.label.formatMethod(1655)).toBe('1,655')
    expect(
      result.spec_user_rank.tooltip.mark.content[0].value({
        rawTokens: 1655,
      })
    ).toBe('1,655')
    expect(
      result.spec_user_trend.tooltip.mark.content[0].value({
        rawTokens: 345,
      })
    ).toBe('345')
  })

  test('uses token fields for empty ranking and trend charts', () => {
    const result = processUserChartData([])

    expect(result.spec_user_rank.xField).toBe('rawTokens')
    expect(result.spec_user_trend.yField).toBe('rawTokens')
  })
})
