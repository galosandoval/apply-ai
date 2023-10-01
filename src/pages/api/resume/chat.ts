import { OpenAIStream, StreamingTextResponse } from "ai"
import { type NextRequest } from "next/server"
import {
  type ChatCompletionRequestMessage,
  Configuration,
  OpenAIApi
} from "openai-edge"
import { z } from "zod"

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})
const openai = new OpenAIApi(configuration)

export const config = {
  runtime: "edge"
}

export const chatParams = z.object({
  name: z.string(),
  profession: z.string(),
  skills: z.string(),
  experience: z.string(),
  education: z.string(),
  interests: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string()
    })
  )
})

export type ChatParams = z.infer<typeof chatParams>

// const schema = {
//   type: "object",
//   properties: {
//     introduction: {
//       type: "string",
//       description:
//         "Introduction of user with brief description of entire profile."
//     },
//     skills: {
//       type: "array",
//       description: "Array of skills.",
//       items: { type: "string" }
//     },
//     workExperience: {
//       type: "array",
//       description: "Array of work experience objects.",
//       items: {
//         type: "object",
//         description: "Work experience object",
//         properties: {
//           description: {
//             type: "string",
//             description: "Description of work experience."
//           },
//           companyName: {
//             type: "string",
//             description: "Name of company."
//           },
//           startDate: {
//             type: "string",
//             description: "Start date of work experience."
//           },
//           endDate: {
//             type: "string",
//             description: "End date of work experience."
//           },
//           title: {
//             type: "string",
//             description: "Title of work experience."
//           },
//           keyAchievements: {
//             type: "array",
//             description: "Array of key achievements.",
//             items: { type: "string" }
//           }
//         }
//       }
//     },
//     education: {
//       type: "array",
//       description: "Array of education objects.",
//       items: {
//         type: "object",
//         description: "Education object",
//         properties: {
//           description: {
//             type: "string",
//             description: "Description of education."
//           },
//           schoolName: {
//             type: "string",
//             description: "Name of school."
//           },
//           startDate: {
//             type: "string",
//             description: "Start date of education."
//           },
//           endDate: {
//             type: "string",
//             description: "End date of education."
//           },
//           degree: {
//             type: "string",
//             description: "Degree of education."
//           },
//           gpa: {
//             type: "string",
//             description: "GPA of education."
//           },
//           keyAchievements: {
//             type: "array",
//             description: "Array of key achievements.",
//             items: { type: "string" }
//           }
//         }
//       }
//     }
//   }
// }

const schema = {
  type: "object",
  properties: {
    dish: {
      type: "string",
      description: "Descriptive title of the dish"
    },
    ingredients: {
      type: "array",
      items: { type: "string" }
    },
    instructions: {
      type: "array",
      description: "Steps to prepare the recipe.",
      items: { type: "string" }
    }
  }
}

export default async function handler(req: NextRequest) {
  const request = await req.json()

  const input = chatParams.parse(request)
  const {
    education,
    experience,
    name,
    profession,
    skills,
    interests,
    messages
  } = input

  console.log("messages", messages[0])

  const chat: ChatCompletionRequestMessage[] = [
    {
      role: "system",
      content: "You are a helpful resume building assistant."
    },
    {
      role: "user",
      content: `Generate a resume based on the following user's information: Name: ${name}, Work Experience: ${experience}, Skills: ${skills}, Interests: ${interests}, Education: ${education}. Incorporate the keywords and phrases typically found in a ${profession} job description into the resume, ensuring it is tailored to match the job requirements. Also, use the job description provided to fill in the resume with keywords. The following is the job description ${messages[0]?.content}`
    }
  ]
  const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-0613",
    stream: true,
    messages: chat,
    functions: [{ name: "set_resume", parameters: schema }],
    function_call: { name: "set_resume" }
  })

  // Convert the response into a friendly text-stream
  const stream = OpenAIStream(response)
  // Respond with the stream
  return new StreamingTextResponse(stream)
}
