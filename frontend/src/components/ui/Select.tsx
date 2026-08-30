import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

interface OptionElementProps {
  value: string
  children?: ReactNode
  disabled?: boolean
}

interface Props {
  id?: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  disabled?: boolean
  required?: boolean
  className?: string
  'aria-label'?: string
  children: ReactNode
}

export default function Select({
  id,
  value,
  onChange,
  invalid,
  disabled,
  required,
  className,
  children,
  ...rest
}: Props) {
  const options = Children.toArray(children).filter(isValidElement) as ReactElement<OptionElementProps>[]
  // Call sites pass native `<option value={m.id}>` elements where m.id is often a number, since
  // that's valid on a real DOM <option>. Radix's Select requires string item values throughout
  // (Root's value, each Item's value, and the map it uses internally to look up an item's text
  // for the closed trigger all key off exact value equality), so values are coerced to strings
  // here at the boundary rather than relying on every call site to do it.
  const optionValues = options.map((option) => String(option.props.value))
  // A `<option value="">Placeholder text</option>` (the app's existing "nothing selected yet"
  // convention) can't be rendered as a Radix SelectItem: Radix reserves the empty string as its
  // own "no value selected" sentinel, so an Item with value="" throws at runtime. Surface its
  // text as the trigger's placeholder instead of rendering it as a pickable item.
  const placeholder = options.find((_, i) => optionValues[i] === '')?.props.children
  const items = options
    .map((option, i) => ({ option, value: optionValues[i] }))
    .filter(({ value }) => value !== '')

  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled} required={required}>
      <SelectPrimitive.Trigger
        id={id}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50',
          invalid ? 'border-danger' : 'border-black/15',
          className
        )}
        {...rest}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border border-black/15 bg-surface text-ink shadow-md"
        >
          <SelectPrimitive.Viewport className="p-1">
            {items.map(({ option, value: itemValue }) => (
              <SelectPrimitive.Item
                key={itemValue}
                value={itemValue}
                disabled={option.props.disabled}
                className="relative flex cursor-default select-none items-center rounded-md px-2 py-1.5 text-sm outline-none focus:bg-primary-light data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                <SelectPrimitive.ItemText>{option.props.children}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
