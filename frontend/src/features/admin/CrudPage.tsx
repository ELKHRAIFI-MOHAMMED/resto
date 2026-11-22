import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { cx } from '@/lib/cx'
import { useToastStore } from '@/store/toast'

import { TABLE, TD, TH } from './helpers'
import { FormError, Modal, PageHeader } from './ui'

export interface Column<T> {
  header: string
  cell: (item: T, index: number, items: T[]) => ReactNode
}

interface CrudPageProps<T extends { id: number }, V> {
  title: string
  newLabel: string
  queryKey: string
  load: () => Promise<T[]>
  save: (values: V, existing: T | null) => Promise<unknown>
  remove: (item: T) => Promise<unknown>
  toValues: (item: T | null) => V
  nameOf: (item: T) => string
  columns: Column<T>[]
  renderForm: (values: V, set: (patch: Partial<V>) => void, error: unknown) => ReactNode
  intro?: ReactNode
}

/** A small collection managed in one table with a modal form (add-ons, zones, categories). */
export function CrudPage<T extends { id: number }, V>(props: CrudPageProps<T, V>) {
  const {
    title,
    newLabel,
    queryKey,
    load,
    save,
    remove,
    toValues,
    nameOf,
    columns,
    renderForm,
    intro,
  } = props
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showToast = useToastStore((state) => state.show)
  const [editing, setEditing] = useState<{ item: T | null; values: V } | null>(null)

  const {
    data: items,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', queryKey],
    queryFn: load,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', queryKey] })

  const saveMutation = useMutation({
    mutationFn: ({ values, item }: { values: V; item: T | null }) => save(values, item),
    onSuccess: () => {
      setEditing(null)
      showToast({ message: t('admin.common.saved') })
      void refresh()
    },
  })
  const deleteMutation = useMutation({
    mutationFn: remove,
    onSuccess: (_result, item) => {
      showToast({ message: t('admin.common.deleted', { name: nameOf(item) }) })
      void refresh()
    },
  })

  const open = (item: T | null) => {
    saveMutation.reset()
    setEditing({ item, values: toValues(item) })
  }
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (editing) saveMutation.mutate({ values: editing.values, item: editing.item })
  }
  const onDelete = (item: T) => {
    if (window.confirm(t('admin.common.deleteConfirm', { name: nameOf(item) })))
      deleteMutation.mutate(item)
  }

  return (
    <>
      <PageHeader
        title={title}
        actions={
          <Button onClick={() => open(null)}>
            <Plus aria-hidden className="size-4" />
            {newLabel}
          </Button>
        }
      />
      {intro}
      <FormError error={deleteMutation.error} />
      {isPending ? (
        <Skeleton className="h-64" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className={TABLE}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.header} className={TH}>
                    {column.header}
                  </th>
                ))}
                <th className={cx(TH, 'text-end')}>
                  <span className="sr-only">{t('admin.common.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  {columns.map((column) => (
                    <td key={column.header} className={TD}>
                      {column.cell(item, index, items)}
                    </td>
                  ))}
                  <td className={cx(TD, 'text-end whitespace-nowrap')}>
                    <button
                      type="button"
                      onClick={() => open(item)}
                      aria-label={`${t('admin.common.edit')} ${nameOf(item)}`}
                      className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
                    >
                      <Pencil aria-hidden className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      aria-label={`${t('admin.common.delete')} ${nameOf(item)}`}
                      className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-danger"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className={cx(TD, 'text-center text-muted')}>
                    {t('admin.common.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal
          title={editing.item ? `${t('admin.common.edit')} : ${nameOf(editing.item)}` : newLabel}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={onSubmit} className="space-y-6">
            {renderForm(
              editing.values,
              (patch) =>
                setEditing(
                  (current) => current && { ...current, values: { ...current.values, ...patch } },
                ),
              saveMutation.error,
            )}
            <FormError error={saveMutation.error} />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                {t('admin.common.cancel')}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending
                  ? t('admin.common.saving')
                  : editing.item
                    ? t('admin.common.save')
                    : t('admin.common.create')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
