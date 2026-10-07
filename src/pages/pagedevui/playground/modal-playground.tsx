import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from '@heroui/react'
import { useState } from 'react'
import { ComponentPlayground, ControlSelect, PlaygroundControls, PlaygroundPreview } from '../components'

const sizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', 'full'] as const

const backdrops = [
  { key: 'opaque', label: 'Opaque' },
  { key: 'blur', label: 'Blur' },
  { key: 'transparent', label: 'Transparent' },
] as const

type Size = (typeof sizes)[number]
type Backdrop = (typeof backdrops)[number]['key']

const defaultValues = {
  size: 'md' as Size,
  backdrop: 'opaque' as Backdrop,
}

export const ModalPlayground = () => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [size, setSize] = useState<Size>(defaultValues.size)
  const [backdrop, setBackdrop] = useState<Backdrop>(defaultValues.backdrop)

  const handleOpen = (size: Size) => {
    setSize(size)
    onOpen()
  }

  return (
    <ComponentPlayground id="modal" title="Modal">
      <PlaygroundControls>
        <></>
        <ControlSelect label="Backdrop" value={backdrop} onChange={setBackdrop} options={backdrops} />
      </PlaygroundControls>

      <PlaygroundPreview>
        <>
          <div className="flex flex-wrap gap-3">
            {sizes.map((size) => (
              <Button key={size} onPress={() => handleOpen(size)}>
                Open {size}
              </Button>
            ))}
          </div>
          <Modal isOpen={isOpen} size={size as Size} backdrop={backdrop} onClose={onClose}>
            <ModalContent>
              {(onClose) => (
                <>
                  <ModalHeader className="flex flex-col gap-1">Modal Title</ModalHeader>
                  <ModalBody>
                    <p>
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam pulvinar risus non risus hendrerit venenatis.
                      Pellentesque sit amet hendrerit risus, sed porttitor quam.
                    </p>
                    <p>
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam pulvinar risus non risus hendrerit venenatis.
                      Pellentesque sit amet hendrerit risus, sed porttitor quam.
                    </p>
                    <p>
                      Magna exercitation reprehenderit magna aute tempor cupidatat consequat elit dolor adipisicing. Mollit dolor eiusmod
                      sunt ex incididunt cillum quis. Velit duis sit officia eiusmod Lorem aliqua enim laboris do dolor eiusmod.
                    </p>
                  </ModalBody>
                  <ModalFooter>
                    <Button color="danger" variant="light" onPress={onClose}>
                      Close
                    </Button>
                    <Button color="primary" onPress={onClose}>
                      Action
                    </Button>
                  </ModalFooter>
                </>
              )}
            </ModalContent>
          </Modal>
        </>
      </PlaygroundPreview>
    </ComponentPlayground>
  )
}
