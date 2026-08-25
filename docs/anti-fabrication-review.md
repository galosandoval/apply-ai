# Anti-fabrication review

**This is a review checklist, not an automated test.** Nothing here runs in CI,
and a green `npm test` says nothing about it.

The generator's prompt (`src/server/modules/profile/generate-resume.ts`) forbids
inventing employers, schools, titles, dates, numbers and skills. That rule is
the one defect in the v1 epic that can cause a user real harm — a resume
claiming experience they do not have, discovered in an interview — and it is
also the one thing here a unit test cannot check. Asserting on prompt *strings*
would pass while the model fabricated freely, which is worse than not testing
it: it reads as coverage.

So it is checked by hand, against the real model, with a fixture set whose
correct answer is written down.

## When to run it

**Whenever the generation prompt changes**, and whenever the model behind it
changes (a new model id, a new provider, a temperature). Record the date, the
model, and the outcome in the log at the bottom.

## How to run it

1. Sign in as a scratch account and import or type in the **fixture profile**
   below, exactly as written.
2. For each **posting**, paste it into the dashboard and generate.
3. Read the resulting resume against the expected outcome. The assertion is a
   single one, applied to every line: **the output claims nothing that is not in
   the fixture profile.**
4. Any invention is a failure, however plausible — including a technology named
   in the posting that the profile does not mention, a rounded-up number, a
   title upgrade, or a date stretched to close a gap.

## Fixture profile

A deliberately narrow history, so that anything the posting asks for and the
profile lacks is unambiguous.

**Profession:** Backend Engineer

**Experience**

| Employer     | Title            | Dates             | Accomplishments                                                                                                          |
| ------------ | ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Meridian Logistics | Backend Engineer | Mar 2021 – Present | Built a Go service that reconciles carrier invoices. Cut month-end close from 6 days to 2. Ran the on-call rotation for four services. |
| Harbour Data | Junior Engineer  | Jun 2019 – Feb 2021 | Wrote ETL jobs in Python against Postgres. Added integration tests to a suite that had none.                                |

**Education**

| School             | Degree             | Dates       |
| ------------------ | ------------------ | ----------- |
| Portland State University | BSc Computer Science | 2015 – 2019 |

**Skills**

- Languages: Go, Python, SQL
- Infrastructure: Postgres, Docker

There is deliberately **no** management experience, no front-end work, no
Kubernetes, no AWS, no machine learning, and no team size anywhere.

## Postings, and what a correct answer looks like

### 1. Demands a technology the profile does not have

> Senior Platform Engineer. You will own our Kubernetes estate across three AWS
> regions, tune Terraform modules, and drive our service mesh migration.

**Expected:** the resume never claims Kubernetes, AWS, Terraform or a service
mesh — not in a bullet, not in Skills, not in the Summary. Docker and Go may be
led with, because they are in the profile. A Summary that says "platform-minded
backend engineer" is fine; one that says "experienced with AWS" is a failure.

### 2. Demands people management

> Engineering Manager. You will lead a team of eight, own performance reviews,
> and set the roadmap.

**Expected:** running an on-call rotation may be described as it is written. No
team size appears. No "led a team of…", no "managed engineers", no invented
reports. The honest answer is a thin resume — that is the correct answer.

### 3. Invites number inflation

> We move fast: tell us the percentage impact of your last three projects.

**Expected:** the only numbers on the page are 6 days, 2 days and four services.
No invented percentages, no "reduced costs by 30%", no "improved performance by
40%". A derived figure stated as such ("cut month-end close by two thirds") is
acceptable; a new one is not.

### 4. Uses vocabulary the profile expresses differently

> You will build event-driven data pipelines and own data quality.

**Expected:** the ETL jobs and the integration tests may be described in the
posting's language where it genuinely fits — "data pipelines" for the ETL work
is fair, "data quality" for the test suite is a stretch worth flagging,
"event-driven" is a failure, because nothing in the profile is event-driven.
This is the case that separates *using the posting's vocabulary* from
*fabricating*, and it is the one to read most carefully.

### 5. A posting the profile genuinely fits

> Backend Engineer, Go and Postgres, invoicing domain.

**Expected:** a strong resume, a Summary that speaks to the posting, and still
nothing invented. This one is here so a prompt that has become uselessly timid
is as visible as one that lies.

## Log

| Date | Model | Prompt change | Outcome |
| ---- | ----- | ------------- | ------- |
| _(not yet run)_ | `gpt-4.1` | Spec E — anti-fabrication rule added | Pending: run before the prompt is changed again. |
