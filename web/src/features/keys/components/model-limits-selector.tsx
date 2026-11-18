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
import { Settings2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { UserModelChannel } from '@/lib/api'

import { ModelLimitsDialog } from './model-limits-dialog'

type ModelLimitsSelectorProps = {
  id?: string
  models: string[]
  channels: UserModelChannel[]
  value: string[]
  onChange: (models: string[]) => void
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export function ModelLimitsSelector(props: ModelLimitsSelectorProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className='space-y-3'>
      <div className='bg-muted/20 max-h-40 min-h-20 overflow-y-auto rounded-lg border p-3'>
        {props.value.length > 0 ? (
          <div className='flex flex-wrap gap-1.5'>
            {props.value.map((model) => (
              <Badge
                key={model}
                variant='secondary'
                className='h-auto max-w-full py-1 font-mono text-xs break-all whitespace-normal'
              >
                {model}
              </Badge>
            ))}
          </div>
        ) : (
          <p className='text-muted-foreground text-sm'>
            {t('All models allowed')}
          </p>
        )}
      </div>
      <Button
        id={props.id}
        type='button'
        variant='outline'
        className='w-full'
        aria-describedby={props['aria-describedby']}
        aria-invalid={props['aria-invalid']}
        onClick={() => setOpen(true)}
      >
        <Settings2 aria-hidden='true' />
        {t('Select models')}
      </Button>
      {open && (
        <ModelLimitsDialog
          open
          models={props.models}
          channels={props.channels}
          value={props.value}
          onOpenChange={setOpen}
          onApply={props.onChange}
        />
      )}
    </div>
  )
}
