import { type Node, type NodeProps } from '@xyflow/react'
import { Textarea } from '@heroui/react'
import { Grip, StickyNote } from 'lucide-react'
import { useState } from 'react'

export interface NoteNodeData extends Record<string, unknown> {
  text: string
  selected: boolean
  onCommit: (text: string) => void
}

export type NoteFlowNode = Node<NoteNodeData, 'note'>

function NoteEditor({ text, onCommit }: Pick<NoteNodeData, 'text' | 'onCommit'>) {
  const [draft, setDraft] = useState(text)
  return (
    <Textarea
      aria-label="Layout note"
      disableAutosize
      minRows={4}
      variant="flat"
      className="nodrag nopan nowheel"
      classNames={{
        inputWrapper:
          'rounded-none bg-transparent px-2 py-2 shadow-none data-[hover=true]:bg-transparent group-data-[focus=true]:bg-transparent',
        input: 'min-h-24 resize-y text-xs leading-5 placeholder:text-foreground/60',
      }}
      placeholder="Add a note for this area…"
      value={draft}
      onValueChange={setDraft}
      onBlur={() => onCommit(draft)}
      onPointerDown={(event) => event.stopPropagation()}
    />
  )
}

export function NoteNode({ data }: NodeProps<NoteFlowNode>) {
  return (
    <div className={`base-note w-48 border bg-content1/95 ${data.selected ? 'border-primary' : 'border-divider'}`}>
      <div className="base-note-handle flex cursor-grab items-center gap-2 border-b border-divider px-2 py-1.5 text-[11px] font-semibold text-foreground/70 active:cursor-grabbing">
        <StickyNote size={13} className="text-primary" aria-hidden />
        Note
        <Grip size={12} className="ml-auto text-foreground/40" aria-hidden />
      </div>
      <NoteEditor key={data.text} text={data.text} onCommit={data.onCommit} />
    </div>
  )
}
