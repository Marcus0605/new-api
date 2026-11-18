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
import { ChevronDown } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UserModelChannel } from '@/lib/api'

type ModelGroup = {
  id: string
  name: string
  models: string[]
  unavailable?: boolean
}

type ModelLimitsDialogProps = {
  open: boolean
  models: string[]
  channels: UserModelChannel[]
  value: string[]
  onOpenChange: (open: boolean) => void
  onApply: (models: string[]) => void
}

export function ModelLimitsDialog(props: ModelLimitsDialogProps) {
  const { t } = useTranslation()
  const id = useId()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set(props.value))

  const availableModels = useMemo(
    () => [
      ...new Set([
        ...props.models,
        ...props.channels.flatMap((channel) => channel.models),
      ]),
    ],
    [props.models, props.channels]
  )

  const groups = useMemo<ModelGroup[]>(() => {
    const availableSet = new Set(availableModels)
    const groupedModels = new Set<string>()
    const result: ModelGroup[] = props.channels.map((channel) => {
      const models = [
        ...new Set(channel.models.filter((model) => availableSet.has(model))),
      ]
      models.forEach((model) => groupedModels.add(model))
      return {
        id: `channel-${channel.id}`,
        name: channel.name,
        models,
      }
    })
    const ungrouped = availableModels.filter(
      (model) => !groupedModels.has(model)
    )
    if (ungrouped.length > 0) {
      result.push({
        id: 'ungrouped',
        name: t('Models without channel information'),
        models: ungrouped,
      })
    }
    const unavailable = props.value.filter((model) => !availableSet.has(model))
    if (unavailable.length > 0) {
      result.push({
        id: 'unavailable',
        name: t('Currently unavailable models'),
        models: unavailable,
        unavailable: true,
      })
    }
    return result.filter((group) => group.models.length > 0)
  }, [availableModels, props.channels, props.value, t])

  const keyword = search.trim().toLocaleLowerCase()
  const matchingModels = useMemo(
    () =>
      keyword
        ? availableModels.filter((model) =>
            model.toLocaleLowerCase().includes(keyword)
          )
        : [],
    [availableModels, keyword]
  )
  const visibleGroups = useMemo(
    () =>
      keyword
        ? groups
            .map((group) => ({
              ...group,
              models: group.models.filter((model) =>
                model.toLocaleLowerCase().includes(keyword)
              ),
            }))
            .filter((group) => group.models.length > 0)
        : groups,
    [groups, keyword]
  )

  const updateModels = (models: string[], checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      models.forEach((model) => {
        if (checked) next.add(model)
        else next.delete(model)
      })
      return next
    })
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Select models')}
      description={t(
        'Select models individually, by keyword, or by channel. Changes are applied only after confirmation.'
      )}
      contentClassName='sm:max-w-4xl'
      contentHeight='min(68dvh, 720px)'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            onClick={() => {
              props.onApply([...selected])
              props.onOpenChange(false)
            }}
          >
            {t('Apply selection')}
          </Button>
        </>
      }
    >
      <div className='flex flex-wrap items-center gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => updateModels(availableModels, true)}
        >
          {t('Select all')}
        </Button>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => setSelected(new Set())}
        >
          {t('Deselect all')}
        </Button>
        <span className='text-muted-foreground ml-auto text-sm'>
          {t('{{n}} model(s) selected', { n: selected.size })}
        </span>
      </div>

      <div className='space-y-2 rounded-lg border p-3'>
        <Label htmlFor={`${id}-search`}>{t('Filter by keyword')}</Label>
        <Input
          id={`${id}-search`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('Enter a model keyword')}
        />
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={!keyword || matchingModels.length === 0}
            onClick={() => updateModels(matchingModels, true)}
          >
            {t('Select matching models')}
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={!keyword || matchingModels.length === 0}
            onClick={() => updateModels(matchingModels, false)}
          >
            {t('Deselect matching models')}
          </Button>
          {keyword && (
            <span className='text-muted-foreground self-center text-xs'>
              {t('{{count}} models match', { count: matchingModels.length })}
            </span>
          )}
        </div>
      </div>

      <div className='space-y-2'>
        {visibleGroups.map((group, groupIndex) => {
          const selectedCount = group.models.filter((model) =>
            selected.has(model)
          ).length
          const allSelected = selectedCount === group.models.length
          return (
            <Collapsible
              key={group.id}
              defaultOpen
              className='rounded-lg border'
            >
              <div className='flex items-center gap-2 px-3'>
                <Checkbox
                  aria-label={t('Select all models in {{category}}', {
                    category: group.name,
                  })}
                  checked={allSelected}
                  indeterminate={selectedCount > 0 && !allSelected}
                  onCheckedChange={(checked) =>
                    updateModels(group.models, Boolean(checked))
                  }
                />
                <CollapsibleTrigger
                  render={
                    <Button
                      type='button'
                      variant='ghost'
                      className='min-w-0 flex-1 justify-between px-0 hover:bg-transparent aria-expanded:bg-transparent dark:hover:bg-transparent'
                    />
                  }
                >
                  <span className='min-w-0 truncate text-left'>
                    {group.name}
                  </span>
                  <span className='text-muted-foreground ml-auto shrink-0 text-xs'>
                    {t('{{selected}} of {{total}} selected', {
                      selected: selectedCount,
                      total: group.models.length,
                    })}
                  </span>
                  <ChevronDown className='size-4 shrink-0' aria-hidden='true' />
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className='border-t px-3 py-2'>
                {group.unavailable && (
                  <p className='text-muted-foreground mb-2 text-xs'>
                    {t(
                      'These saved models are not currently available. Deselect them to remove their restrictions.'
                    )}
                  </p>
                )}
                <div className='grid gap-2 md:grid-cols-2'>
                  {group.models.map((model, modelIndex) => {
                    const checkboxId = `${id}-${groupIndex}-${modelIndex}`
                    return (
                      <div
                        key={model}
                        className='flex min-w-0 items-start gap-2'
                      >
                        <Checkbox
                          id={checkboxId}
                          className='mt-0.5'
                          checked={selected.has(model)}
                          onCheckedChange={(checked) =>
                            updateModels([model], Boolean(checked))
                          }
                        />
                        <Label
                          htmlFor={checkboxId}
                          className='min-w-0 cursor-pointer text-sm font-normal break-all'
                        >
                          {model}
                        </Label>
                      </div>
                    )
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
        {visibleGroups.length === 0 && (
          <p className='text-muted-foreground py-8 text-center text-sm'>
            {t('No matching items')}
          </p>
        )}
      </div>
    </Dialog>
  )
}
