import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { type RouterOutputs, api } from "~/utils/api"
import { useUser } from "~/utils/useUser"

export default function Step5() {
  const { id: userId } = useUser()

  const { data: profile, status } = api.profile.read.useQuery(
    { userId },
    {
      enabled: !!userId,

      onError: (error) => {
        toast.error(error.message)
      }
    }
  )

  if (status === "error") {
    return <div>Something went wrong, try refreshing the page</div>
  }

  if (status === "success") {
    return <Profile data={profile} />
  }

  return <div className="">Loading...</div>
}

function Profile({ data }: { data: RouterOutputs["profile"]["read"] }) {
  const router = useRouter()

  return (
    <div className="">
      <h1>How does this look?</h1>

      <div className="">
        <div>
          <div className="">
            <div className="label">
              <span className="label-text">First Name</span>
            </div>

            <div className="rounded-sm px-2 py-1">{data?.firstName}</div>
          </div>
        </div>

        <div>
          <div className="">
            <div className="label">
              <span className="label-text">Last Name</span>
            </div>

            <div className="rounded-sm px-2 py-1">{data?.lastName}</div>
          </div>
        </div>

        <button
          onClick={() => router.push("/onboarding/step1")}
          className="btn btn-outline"
        >
          Edit
        </button>
      </div>

      <div className="">
        <h2 className="">Education</h2>

        <button
          onClick={() => router.push("/onboarding/step3")}
          className="btn btn-outline"
        >
          Edit
        </button>
      </div>

      {data.education.map((s) => (
        <div className="" key={s.id}>
          <div className="">
            <div className="label">
              <span className="label-text">School Name</span>
            </div>

            <div className="rounded-sm px-2 py-1">{s?.name}</div>
          </div>

          <div className="">
            <div className="label">
              <span className="label-text">Start date</span>
            </div>

            <div className="rounded-sm px-2 py-1">{s?.startDate}</div>
          </div>

          <div className="">
            <div className="label">
              <span className="label-text">End date</span>
            </div>

            <div className="rounded-sm px-2 py-1">{s?.endDate}</div>
          </div>

          <div className="">
            <div className="label">
              <span className="label-text">Degree</span>
            </div>

            <div className="rounded-sm px-2 py-1">{s?.degree}</div>
          </div>
        </div>
      ))}

      <div className="">
        <h2 className="">Experience</h2>

        <button
          onClick={() => router.push("/onboarding/step4")}
          className="btn btn-outline"
        >
          Edit
        </button>
      </div>

      {data.experience.map((j) => (
        <div className="" key={j.id}>
          <div className="">
            <div className="label">
              <span className="label-text">Degree</span>
            </div>

            <div className="rounded-sm px-2 py-1">{j.companyName}</div>
          </div>

          <div className="">
            <div className="label">
              <span className="label-text">Accomplishments</span>
            </div>

            <div className="rounded-sm px-2 py-1">{j.description}</div>
          </div>

          <div className="">
            <div className="label">
              <span className="label-text">Start Date</span>
            </div>

            <div className="rounded-sm px-2 py-1">{j.startDate}</div>
          </div>

          <div className="">
            <div className="label">
              <span className="label-text">End Date</span>
            </div>

            <div className="rounded-sm px-2 py-1">{j.endDate}</div>
          </div>

          <div className="">
            <div className="label">
              <span className="label-text">Title</span>
            </div>

            <div className="rounded-sm px-2 py-1">{j.title}</div>
          </div>
        </div>
      ))}

      <div className="">
        <h2 className="">Skills</h2>

        <button
          onClick={() => router.push("/onboarding/step5")}
          className="btn btn-outline"
        >
          Edit
        </button>
      </div>

      {data.skills?.map((s) => (
        <div className="" key={s}>
          <div className="rounded-sm px-2 py-1">{s}</div>
        </div>
      ))}

      <button
        onClick={() => router.push("/dashboard")}
        className="btn btn-primary"
        type="submit"
      >
        Done
      </button>
    </div>
  )
}
