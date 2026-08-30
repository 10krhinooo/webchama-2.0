import type { ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

export default function Modal({ title, onClose, children }: Props) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        {/*
          Centred by flex, not by `left-1/2 -translate-x-1/2`. The open and close animations set
          `transform` themselves, which overrides a static translate, so a translate-centred dialog
          renders at 50% of the viewport rather than in the middle of it. On a desktop screen that
          reads as slightly off-centre and nobody notices; on a phone the dialog hangs off the
          right edge with its fields cut in half.

          The wrapper takes no pointer events so a click beside the dialog still reaches the
          overlay behind it and closes the dialog; the dialog itself takes them back.
        */}
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Content className="pointer-events-auto flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-surface shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <DialogPrimitive.Title className="font-heading text-lg font-semibold text-ink">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close type="button" className="text-muted hover:text-ink" aria-label="Close">
                <XMarkIcon className="w-5 h-5" />
              </DialogPrimitive.Close>
            </div>
            <div className="overflow-y-auto p-6">{children}</div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
