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
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { ModelMappingDerivation, ModelMappingRule } from '../lib'

type UpstreamUpdateMappingProps = {
  rule: ModelMappingRule
  onRuleChange: (rule: ModelMappingRule) => void
  derivation: ModelMappingDerivation
  hasRule: boolean
  syncModels: boolean
  onSyncModelsChange: (sync: boolean) => void
  disabled: boolean
}

export function UpstreamUpdateMapping(props: UpstreamUpdateMappingProps) {
  const { t } = useTranslation()
  const id = useId()
  const isPrefix =
    props.rule.type === 'add-prefix' || props.rule.type === 'strip-prefix'
  const isStrip =
    props.rule.type === 'strip-prefix' || props.rule.type === 'strip-suffix'
  let affix = ''
  if ('values' in props.rule) {
    affix = props.rule.values
  } else if ('value' in props.rule) {
    affix = props.rule.value
  }
  const ruleOptions: Array<{ value: ModelMappingRule['type']; label: string }> =
    [
      { value: 'strip-suffix', label: t('Strip suffix') },
      { value: 'strip-prefix', label: t('Strip prefix') },
      { value: 'add-suffix', label: t('Add suffix') },
      { value: 'add-prefix', label: t('Add prefix') },
      { value: 'replace', label: t('Replace text') },
    ]

  return (
    <section
      aria-labelledby={`${id}-title`}
      className='space-y-3 rounded-lg border p-3'
    >
      <div>
        <h3 id={`${id}-title`} className='text-sm font-semibold'>
          {t('Set up redirect')}
        </h3>
        <p className='text-muted-foreground mt-1 text-xs'>
          {t('Redirect fetched upstream names to the names your users call.')}
        </p>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-rule`}>{t('Rule')}</FieldLabel>
          <Select
            items={ruleOptions}
            value={props.rule.type}
            disabled={props.disabled}
            onValueChange={(value) => {
              const option = ruleOptions.find((item) => item.value === value)
              if (!option) return
              if (
                option.value === 'strip-prefix' ||
                option.value === 'strip-suffix'
              ) {
                props.onRuleChange({ type: option.value, values: '' })
              } else if (
                option.value === 'add-prefix' ||
                option.value === 'add-suffix'
              ) {
                props.onRuleChange({ type: option.value, value: '' })
              } else {
                props.onRuleChange({
                  type: 'replace',
                  find: '',
                  replaceWith: '',
                })
              }
            }}
          >
            <SelectTrigger id={`${id}-rule`} className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ruleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {props.rule.type === 'replace' ? (
          <div className='grid gap-3 sm:grid-cols-2'>
            <Field>
              <FieldLabel htmlFor={`${id}-find`}>{t('Find')}</FieldLabel>
              <Input
                id={`${id}-find`}
                placeholder='.'
                value={props.rule.find}
                disabled={props.disabled}
                onChange={(event) => {
                  if (props.rule.type !== 'replace') return
                  props.onRuleChange({
                    ...props.rule,
                    find: event.target.value,
                  })
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-replacement`}>
                {t('Replace with')}
              </FieldLabel>
              <Input
                id={`${id}-replacement`}
                placeholder='-'
                value={props.rule.replaceWith}
                disabled={props.disabled}
                onChange={(event) => {
                  if (props.rule.type !== 'replace') return
                  props.onRuleChange({
                    ...props.rule,
                    replaceWith: event.target.value,
                  })
                }}
              />
            </Field>
          </div>
        ) : (
          <Field>
            <FieldLabel htmlFor={`${id}-affix`}>
              {isPrefix ? t('Prefix') : t('Suffix')}
            </FieldLabel>
            <Input
              id={`${id}-affix`}
              placeholder={isPrefix ? 'openai/' : '-all'}
              value={affix}
              disabled={props.disabled}
              onChange={(event) => {
                if (isStrip) {
                  props.onRuleChange({
                    type: props.rule.type as 'strip-prefix' | 'strip-suffix',
                    values: event.target.value,
                  })
                } else if (
                  props.rule.type === 'add-prefix' ||
                  props.rule.type === 'add-suffix'
                ) {
                  props.onRuleChange({
                    type: props.rule.type,
                    value: event.target.value,
                  })
                }
              }}
            />
            {isStrip && (
              <FieldDescription>
                {t('Separate several values with commas')}
              </FieldDescription>
            )}
          </Field>
        )}
      </FieldGroup>
      <section
        aria-label={t('Review mappings')}
        className='text-muted-foreground space-y-2 text-xs'
      >
        <div className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2'>
          <span>{t('Users call')}</span>
          <span aria-hidden='true'>→</span>
          <span>{t('Upstream receives')}</span>
        </div>
        {props.hasRule && props.derivation.pairs.length > 0 && (
          <ul className='flex max-h-40 flex-col gap-2 overflow-y-auto font-mono'>
            {props.derivation.pairs.map((pair) => (
              <li
                key={pair.from}
                className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2'
              >
                <span className='min-w-0 wrap-anywhere'>{pair.from}</span>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className='size-3.5 shrink-0'
                  aria-hidden='true'
                />
                <span className='min-w-0 wrap-anywhere'>{pair.to}</span>
              </li>
            ))}
          </ul>
        )}
        {!props.hasRule && <p>{t('Enter a rule to preview mappings.')}</p>}
        {props.hasRule &&
          props.derivation.pairs.length === 0 &&
          props.derivation.unchanged.length === 0 && (
            <p>{t('Select at least one model to preview mappings.')}</p>
          )}
        {props.hasRule && props.derivation.unchanged.length > 0 && (
          <p>
            {t('{{count}} model(s) unchanged by the rule were skipped', {
              count: props.derivation.unchanged.length,
            })}
          </p>
        )}
        {props.hasRule && props.derivation.conflicts.length > 0 && (
          <p className='text-warning'>
            {t(
              '{{count}} model(s) skipped because another model derives the same request name',
              { count: props.derivation.conflicts.length }
            )}
          </p>
        )}
      </section>
      <Field orientation='horizontal'>
        <Checkbox
          id={`${id}-sync`}
          checked={props.syncModels}
          disabled={props.disabled}
          onCheckedChange={(checked) =>
            props.onSyncModelsChange(checked === true)
          }
        />
        <FieldLabel htmlFor={`${id}-sync`} className='leading-5 font-normal'>
          {t(
            'Publish the request names and remove the raw upstream names from the model list'
          )}
        </FieldLabel>
      </Field>
    </section>
  )
}
