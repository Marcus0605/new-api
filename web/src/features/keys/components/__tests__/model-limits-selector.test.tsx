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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import type { UserModelChannel } from '@/lib/api'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { ModelLimitsSelector } = await import('../model-limits-selector')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

const models = ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet']
const channels: UserModelChannel[] = [
  { id: 1, name: 'Channel A', models: ['gpt-4o', 'claude-sonnet'] },
  { id: 2, name: 'Channel B', models: ['gpt-4o-mini'] },
]

function renderSelector(
  value: string[] = [],
  onChange: (models: string[]) => void = vi.fn()
) {
  render(
    <I18nextProvider i18n={i18n}>
      <ModelLimitsSelector
        models={models}
        channels={channels}
        value={value}
        onChange={onChange}
      />
    </I18nextProvider>
  )
  return onChange
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Select models' }))
  return screen.getByRole('dialog', { name: 'Select models' })
}

async function applySelection(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Apply selection' }))
}

describe('API key model limits selector', () => {
  test('shows only selected models outside the dialog and discards cancelled edits', async () => {
    const user = userEvent.setup()
    const onChange = renderSelector(['gpt-4o'], vi.fn())

    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
    expect(screen.queryByText('claude-sonnet')).not.toBeInTheDocument()

    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  test('selects every available model while preserving saved unavailable models', async () => {
    const user = userEvent.setup()
    const onChange = renderSelector(['retired-model'], vi.fn())

    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    await applySelection(user)

    expect(onChange).toHaveBeenCalledWith([
      'retired-model',
      'gpt-4o',
      'gpt-4o-mini',
      'claude-sonnet',
    ])
  })

  test('clears all selected models including unavailable models', async () => {
    const user = userEvent.setup()
    const onChange = renderSelector(['gpt-4o', 'retired-model'], vi.fn())

    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Deselect all' }))
    await applySelection(user)

    expect(onChange).toHaveBeenCalledWith([])
  })

  test('selects only models matching the keyword', async () => {
    const user = userEvent.setup()
    const onChange = renderSelector(['claude-sonnet'], vi.fn())

    await openDialog(user)
    await user.type(
      screen.getByRole('textbox', { name: 'Filter by keyword' }),
      'gpt'
    )
    await user.click(
      screen.getByRole('button', { name: 'Select matching models' })
    )
    await applySelection(user)

    expect(onChange).toHaveBeenCalledWith([
      'claude-sonnet',
      'gpt-4o',
      'gpt-4o-mini',
    ])
  })

  test('deselects only models matching the keyword', async () => {
    const user = userEvent.setup()
    const onChange = renderSelector(models, vi.fn())

    await openDialog(user)
    await user.type(
      screen.getByRole('textbox', { name: 'Filter by keyword' }),
      'gpt'
    )
    await user.click(
      screen.getByRole('button', { name: 'Deselect matching models' })
    )
    await applySelection(user)

    expect(onChange).toHaveBeenCalledWith(['claude-sonnet'])
  })

  test('selects all models belonging to one channel', async () => {
    const user = userEvent.setup()
    const onChange = renderSelector([], vi.fn())

    await openDialog(user)
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select all models in Channel A',
      })
    )
    await applySelection(user)

    expect(onChange).toHaveBeenCalledWith(['gpt-4o', 'claude-sonnet'])
  })

  test('deselects all models belonging to one channel without removing other channel models', async () => {
    const user = userEvent.setup()
    const onChange = renderSelector(models, vi.fn())

    await openDialog(user)
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select all models in Channel A',
      })
    )
    await applySelection(user)

    expect(onChange).toHaveBeenCalledWith(['gpt-4o-mini'])
  })

  test('applies an individual model checkbox change', async () => {
    const user = userEvent.setup()
    const onChange = renderSelector([], vi.fn())

    await openDialog(user)
    await user.click(screen.getByRole('checkbox', { name: 'gpt-4o-mini' }))
    await applySelection(user)

    expect(onChange).toHaveBeenCalledWith(['gpt-4o-mini'])
  })
})
