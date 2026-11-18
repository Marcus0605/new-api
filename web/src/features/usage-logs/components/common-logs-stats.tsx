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
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { toIntlLocale } from '@/i18n/languages'
import {
  formatCompactNumber,
  formatLogQuota,
  formatNumber,
  formatPercent,
  formatUseTime,
} from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getLogStats, getUserLogStats } from '../api'
import { DEFAULT_LOG_STATS } from '../constants'
import { buildApiParams } from '../lib/utils'
import { useLogsViewScope, useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

function StatBadge(props: {
  label: string
  value: string | number
  accent: string
  title?: string
}) {
  return (
    <span
      className='border-border/60 bg-muted/25 inline-flex h-7 max-w-full items-center gap-2 rounded-md border px-2.5 text-xs shadow-xs'
      title={props.title}
    >
      <span className={cn('h-3.5 w-0.5 rounded-full', props.accent)} />
      <span className='text-muted-foreground'>{props.label}</span>
      <span className='text-foreground/85 font-mono font-semibold tabular-nums'>
        {props.value}
      </span>
    </span>
  )
}

export function CommonLogsStats() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { isAdminView: isAdmin } = useLogsViewScope()
  const searchParams = route.useSearch()
  const { sensitiveVisible } = useUsageLogsContext()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['usage-logs-stats', isAdmin, searchParams],
    queryFn: async () => {
      const params = buildApiParams({
        page: 1,
        pageSize: 1,
        searchParams,
        columnFilters: [],
        isAdmin,
      })

      const result = isAdmin
        ? requireServerSuccess(await getLogStats(params))
        : requireServerSuccess(await getUserLogStats(params))

      return result.success
        ? result.data || DEFAULT_LOG_STATS
        : DEFAULT_LOG_STATS
    },
    placeholderData: (previousData) => previousData,
  })

  if (isLoading) {
    return (
      <div className='flex items-center gap-2'>
        <Skeleton className='h-7 w-[150px] rounded-md' />
        <Skeleton className='h-7 w-[100px] rounded-md' />
        <Skeleton className='h-7 w-[120px] rounded-md' />
      </div>
    )
  }

  const promptTokens = stats?.prompt_tokens ?? 0
  const completionTokens = stats?.completion_tokens ?? 0
  const cacheReadTokens = stats?.cache_read_tokens ?? 0
  const totalTokens = promptTokens + completionTokens
  const inputCacheHitRate =
    promptTokens > 0 ? (cacheReadTokens / promptTokens) * 100 : 0

  return (
    <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
      <StatBadge
        label={t('Usage')}
        value={sensitiveVisible ? formatLogQuota(stats?.quota || 0) : '••••'}
        accent='bg-sky-500/70'
      />
      <StatBadge
        label={t('RPM')}
        value={formatNumber(stats?.rpm ?? 0, locale)}
        accent='bg-rose-500/65'
      />
      <StatBadge
        label={t('TPM')}
        value={formatNumber(stats?.tpm ?? 0, locale)}
        accent='bg-slate-400/70'
      />
      <StatBadge
        label={t('Total Tokens')}
        value={formatCompactNumber(totalTokens, locale)}
        title={formatNumber(totalTokens, locale)}
        accent='bg-violet-500/70'
      />
      <StatBadge
        label={t('Total Input')}
        value={formatCompactNumber(promptTokens, locale)}
        title={formatNumber(promptTokens, locale)}
        accent='bg-blue-500/70'
      />
      <StatBadge
        label={t('Total Output')}
        value={formatCompactNumber(completionTokens, locale)}
        title={formatNumber(completionTokens, locale)}
        accent='bg-indigo-500/70'
      />
      <StatBadge
        label={t('Total Input Cache')}
        value={formatCompactNumber(cacheReadTokens, locale)}
        title={formatNumber(cacheReadTokens, locale)}
        accent='bg-emerald-500/70'
      />
      <StatBadge
        label={t('Average Input Cache Hit Rate')}
        value={formatPercent(inputCacheHitRate)}
        accent='bg-teal-500/70'
      />
      <StatBadge
        label={t('Average Duration')}
        value={formatUseTime(stats?.average_use_time ?? 0)}
        accent='bg-amber-500/70'
      />
    </div>
  )
}
