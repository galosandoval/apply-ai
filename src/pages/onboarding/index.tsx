import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { ChatParams } from "../api/resume/chat"

type Props = {}

export default function Onboarding({}: Props) {
  return (
    <div>
      <form className="flex w-full max-w-prose flex-col gap-3">
        <h3>Section1</h3>

        <input
          type="text"
          placeholder="first name"
          className="rounded-sm px-2 py-1"
        />
        <input
          type="text"
          placeholder="last name"
          className="rounded-sm px-2 py-1"
        />
        <input
          type="text"
          placeholder="job title"
          className="rounded-sm px-2 py-1"
        />
        <textarea
          name=""
          id=""
          placeholder="descip"
          className="rounded-sm px-2 py-1"
        ></textarea>

        <button type="button" className="btn btn-primary btn-active">
          Next
        </button>
      </form>
    </div>
  )
}
