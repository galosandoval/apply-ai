<div align="center">
  <!-- <a href="https://github.com/yourusername/your-resume-generator-app">
    <img src="images/logo.png" alt="App Logo" width="80" height="80">
  </a> -->

  <h3 align="center">Resume Generator with Chat-GPT</h3>

  <p align="center">
    A full-stack TypeScript web app that generates resumes using Chat-GPT.
    <br />
    <br />
    <!-- <a href="https://your-app-demo-link.com">View Demo</a> -->
    <!-- · -->
    <a href="https://github.com/galosandoval/gpt-job/issues">Report Bug</a>
    ·
    <a href="https://github.com/galosandoval/gpt-job/issues">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#technologies-used">Technologies Used</a></li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
        <li><a href="#configuration">Configuration</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#acknowledgments">License</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

<!-- ![App Screenshot](screenshot.png) -->

The Resume Generator with Chat-GPT is a web application that leverages Chat-GPT to generate resumes based on user input. Users can provide information about their qualifications, skills, and experience through a chat-like interface, and the app will generate a professional resume.

### Technologies Used

- [Next.js](https://nextjs.org/)
- [tailwindcss](https://tailwindcss.com/docs/)
- [trpc](https://trpc.io/)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [Zod](https://github.com/colinhacks/zod)
- [React Hook Form](https://react-hook-form.com/)
- [React Query](https://react-query.tanstack.com/)
- [better-auth](https://www.better-auth.com/)
- [Vitest](https://vitest.dev/) and [Playwright](https://playwright.dev/)

<!-- GETTING STARTED -->

## Getting Started

To get started with the Resume Generator, follow the steps below:

### Prerequisites

Make sure you have the following software and services installed:

- Node.js
- npm
- PostrgeSQL

### Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/galosandoval/gpt-job.git
   cd gpt-job
   ```

2. Install dependencies:

   ```bash
   npm install or bun install
   ```

### Configuration

Configure your application by setting up environment variables, such as API keys and database connections. Create a .env file in the root directory and define the necessary variables.

See `.env.example` for the full list.

```bash
DATABASE_URL="your db url"
OPENAI_API_KEY="your openai api key"
BETTER_AUTH_SECRET="openssl rand -base64 32"
APP_URL="http://localhost:3000"
# Only needed to run the router integration tests
TEST_DATABASE_URL="your throwaway db url"
```

## Usage

1. Start the development server:

```base
npm run dev
# or
yarn dev
```

2. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Tests

```bash
npm test         # vitest: parser, schemas, resume markup, and the tRPC router
npm run test:e2e # playwright: sign up, sign in, download a PDF
```

`npm test` runs the router integration tests only when `TEST_DATABASE_URL` is
set; they truncate every table in that database between tests, so point it at a
throwaway one.

### Deployment

Vercel, from `development` — push and it builds. `vercel.json` runs migrations
before the build, so a bad migration fails the deploy instead of the app.

The PDF route prints with a real Chromium, which the Vercel runtime does not
have: `@sparticuz/chromium` ships in the function bundle. See
[docs/deploy-vercel.md](docs/deploy-vercel.md) for the environment variables and
the parts that are easy to get wrong.

<!-- ROADMAP -->

## Roadmap

- [ ] Interactive chat-based resume input.
- [x] Real-time resume generation with Chat-GPT.
- [x] Export and download generated resumes.

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

## Acknowledgments

- [Galo Sandoval](https://github.com/galosandoval)
- [Albert Dang](https://github.com/albertdang8)
