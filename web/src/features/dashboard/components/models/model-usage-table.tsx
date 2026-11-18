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
import { ListOrdered } from 'lucide-react'
import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { calculateModelUsageStats } from '@/features/dashboard/lib'
import type {
  DashboardLogStats,
  DashboardModelUsage,
  QuotaDataItem,
} from '@/features/dashboard/types'
import { toIntlLocale } from '@/i18n/languages'
import { formatCompactNumber, formatNumber, formatPercent } from '@/lib/format'

interface ModelUsageTableProps {
  data: QuotaDataItem[]
  logStats?: DashboardLogStats
  loading: boolean
}

export function ModelUsageTable(props: ModelUsageTableProps) {
  const { t, i18n } = useTranslation()
  const titleId = useId()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const rows = useMemo(
    () => calculateModelUsageStats(props.data, props.logStats),
    [props.data, props.logStats]
  )

  const columns = useMemo<StaticDataTableColumn<DashboardModelUsage>[]>(() => {
    const numericHeader = 'text-right text-xs font-medium whitespace-nowrap'
    const numericCell = 'py-2 text-right font-mono text-xs'
    const tokenCell = (value: number) => (
      <span title={formatNumber(value, locale)}>
        {formatCompactNumber(value, locale)}
      </span>
    )

    return [
      {
        id: 'rank',
        header: t('Rank'),
        className: `w-12 ${numericHeader}`,
        cellClassName: `w-12 ${numericCell}`,
        cell: (_row, index) => index + 1,
      },
      {
        id: 'model',
        header: t('Model'),
        className: 'min-w-52 text-xs font-medium',
        cellClassName: 'min-w-52 max-w-72 py-2 font-mono text-xs',
        cell: (row) => row.modelName || t('Unknown'),
      },
      {
        id: 'requests',
        header: t('Requests'),
        className: numericHeader,
        cellClassName: numericCell,
        cell: (row) => formatNumber(row.requestCount, locale),
      },
      {
        id: 'total-tokens',
        header: t('Total Tokens'),
        className: numericHeader,
        cellClassName: numericCell,
        cell: (row) => tokenCell(row.totalTokens),
      },
      {
        id: 'input-tokens',
        header: t('Input Tokens'),
        className: numericHeader,
        cellClassName: numericCell,
        cell: (row) => tokenCell(row.promptTokens),
      },
      {
        id: 'output-tokens',
        header: t('Output Tokens'),
        className: numericHeader,
        cellClassName: numericCell,
        cell: (row) => tokenCell(row.completionTokens),
      },
      {
        id: 'cache-read',
        header: t('Cache Read'),
        className: numericHeader,
        cellClassName: numericCell,
        cell: (row) => tokenCell(row.cacheReadTokens),
      },
      {
        id: 'cache-hit-rate',
        header: t('Input Cache Hit Rate'),
        className: numericHeader,
        cellClassName: numericCell,
        cell: (row) => formatPercent(row.inputCacheHitRate),
      },
    ]
  }, [locale, t])

  return (
    <section
      className='overflow-hidden rounded-lg border'
      aria-busy={props.loading}
    >
      <div className='flex items-center gap-1.5 border-b px-4 py-2.5'>
        <IconBadge tone='info' size='xs'>
          <ListOrdered />
        </IconBadge>
        <h2 id={titleId} className='text-xs font-semibold'>
          {t('Model Consumption Ranking')}
        </h2>
      </div>
      {props.loading ? (
        <div className='space-y-2 px-4 py-3'>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className='h-5 w-full' />
          ))}
        </div>
      ) : (
        <StaticDataTable
          data={rows}
          columns={columns}
          getRowKey={(row) => row.modelName}
          className='focus-visible:ring-ring max-h-80 overflow-auto rounded-none border-0 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset'
          containerProps={{
            role: 'region',
            tabIndex: 0,
            'aria-labelledby': titleId,
          }}
          tableProps={{ withContainer: false }}
          tableClassName='min-w-[52rem] [&_tbody>tr]:h-9 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-background'
          headerRowClassName='hover:bg-transparent'
          emptyContent={t('No data available')}
          emptyClassName='text-muted-foreground h-20 text-xs'
        />
      )}
    </section>
  )
}
