import { getKeyValue, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react'
import { useState } from 'react'
import { ComponentPlayground, ControlRadioColor, ControlSelect, ControlSwitch, PlaygroundControls, PlaygroundPreview } from '../components'
import { colors } from '../constant'

const modes = [
  { key: 'single', label: 'Single' },
  { key: 'multiple', label: 'Multiple' },
  { key: 'none', label: 'None' },
] as const

type Color = (typeof colors)[number]
type Mode = (typeof modes)[number]['key']

const defaultValues = {
  color: 'default' as Color,
  isEmpty: false,
  hideHeader: false,
  removeWrapper: false,
  isStriped: false,
  mode: 'single' as Mode,
}

const rows = [
  {
    key: '1',
    name: 'Tony Reichert',
    role: 'CEO',
    status: 'Active',
  },
  {
    key: '2',
    name: 'Zoey Lang',
    role: 'Technical Lead',
    status: 'Paused',
  },
  {
    key: '3',
    name: 'Jane Fisher',
    role: 'Senior Developer',
    status: 'Active',
  },
  {
    key: '4',
    name: 'William Howard',
    role: 'Community Manager',
    status: 'Vacation',
  },
]

const columns = [
  {
    key: 'name',
    label: 'NAME',
  },
  {
    key: 'role',
    label: 'ROLE',
  },
  {
    key: 'status',
    label: 'STATUS',
  },
]

export const TablePlayground = () => {
  const [color, setColor] = useState(defaultValues.color)
  const [isEmpty, setIsEmpty] = useState(defaultValues.isEmpty)
  const [hideHeader, setHideHeader] = useState(defaultValues.hideHeader)
  const [removeWrapper, setRemoveWrapper] = useState(defaultValues.removeWrapper)
  const [isStriped, setIsStriped] = useState(defaultValues.isStriped)
  const [mode, setMode] = useState(defaultValues.mode)

  return (
    <ComponentPlayground id="table" title="Table">
      <PlaygroundControls>
        <ControlSelect label="Selection mode" value={mode} onChange={setMode} options={modes} />
        <ControlSwitch label="Empty State" isSelected={isEmpty} onValueChange={setIsEmpty} />
        <ControlSwitch label="Without Header" isSelected={hideHeader} onValueChange={setHideHeader} />
        <ControlSwitch label="Without Wrappe" isSelected={removeWrapper} onValueChange={setRemoveWrapper} />
        <ControlSwitch label="Striped Rows" isSelected={isStriped} onValueChange={setIsStriped} />
        <ControlRadioColor
          label="Selection color"
          value={color}
          onChange={setColor}
          options={colors.map((c) => ({ key: c, label: c, color: c }))}
        />
      </PlaygroundControls>

      <PlaygroundPreview>
        <Table
          color={color}
          hideHeader={hideHeader}
          removeWrapper={removeWrapper}
          isStriped={isStriped}
          defaultSelectedKeys={['2']}
          selectionMode={mode}
          aria-label="Example table with dynamic content"
        >
          <TableHeader columns={columns}>{(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}</TableHeader>
          <TableBody items={rows} emptyContent={'No rows to display.'}>
            {isEmpty
              ? [] // is empty (only)
              : (item) => <TableRow key={item.key}>{(columnKey) => <TableCell>{getKeyValue(item, columnKey)}</TableCell>}</TableRow>}
          </TableBody>
        </Table>
      </PlaygroundPreview>
    </ComponentPlayground>
  )
}
