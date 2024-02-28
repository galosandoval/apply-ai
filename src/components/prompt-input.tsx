import { type ChangeEvent, type KeyboardEvent, useRef, useEffect } from "react"
import { Textarea } from "./ui/textarea"
import { Button } from "./ui/button"
import { PaperPlaneIcon } from "@radix-ui/react-icons"

export function PromptInput({
  input,
  handleInputChange
}: {
  input: string
  handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useAutosizeTextArea(textareaRef.current, input)

  const submitBtnRef = useRef<HTMLButtonElement>(null)

  const onEnter = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && input.trim()) {
      e.preventDefault()
      submitBtnRef.current?.click()
    }
  }

  return (
    <div className="relative flex flex-col">
      <label htmlFor="prompt" className="sr-only">
        Prompt
      </label>

      <Textarea
        className="max-h-[60svh] min-h-[42px] resize-none pr-10"
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        id="prompt"
        placeholder="Paste job description here"
        onKeyDown={onEnter}
      />

      <div className="absolute right-[3px] top-[3px] flex gap-1">
        <Button
          variant="ghost"
          type="submit"
          size="icon"
          className=""
          ref={submitBtnRef}
          disabled={!input.trim()}
        >
          <PaperPlaneIcon />
        </Button>
      </div>
    </div>
  )
}

function useAutosizeTextArea(
  textAreaRef: HTMLTextAreaElement | null,
  value: string
) {
  useEffect(() => {
    if (textAreaRef) {
      // We need to reset the height momentarily to get the correct scrollHeight for the textarea
      textAreaRef.style.height = "0px"
      const scrollHeight = textAreaRef.scrollHeight

      // We then set the height directly, outside of the render loop
      // Trying to set this with state or a ref will product an incorrect value.
      textAreaRef.style.height = scrollHeight + "px"
    }
  }, [textAreaRef, value])
}
