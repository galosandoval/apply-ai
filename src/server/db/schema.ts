import { relations } from "drizzle-orm"
import {
  boolean,
  integer,
  jsonb,
  pgTableCreator,
  text,
  timestamp
} from "drizzle-orm/pg-core"
import { defaultResumeStyle, resumeStyleCatalog } from "~/lib/resume-style"

export const pgTable = pgTableCreator((name) => `apply-ai_${name}`)

/**
 * The account and the profile are one row.
 *
 * They were two tables in a 1:1 relation, which meant every procedure took a
 * `profileId` whose only legal value was "the one this session owns", and a
 * user could exist without a profile — a state the whole app read as
 * "Profile not found". Neither is representable now.
 *
 * `name`, `emailVerified`, `createdAt` and `updatedAt` are better-auth's;
 * `firstName` … `profession` came from `profile`.
 *
 * The account is the **master copy** that seeds a new resume, and nothing more.
 * No resume reads through to it at render time — see `resume`.
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").default("").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  firstName: text("first_name"),
  lastName: text("last_name"),
  profession: text("profession").default("").notNull()
})

export const userRelations = relations(user, ({ many, one }) => ({
  experience: many(work),
  education: many(school),
  contact: one(contact, {
    fields: [user.id],
    references: [contact.userId]
  }),
  resumes: many(resume),
  skills: many(skill)
}))

/** better-auth owns these three. Password hashes live on `account`. */
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  /** Namespaces `accountId`: better-auth scopes account identity by issuer. */
  issuer: text("issuer").default("").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

/**
 * A skill group, either the account's master copy (`resumeId` null) or one
 * resume's snapshot of it (`resumeId` set).
 *
 * The two are never the same row: editing a resume's skills has to be unable to
 * reach a resume the user already sent.
 */
export const skill = pgTable("skill", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  all: text("all").array().notNull(),
  position: integer("position").notNull(),
  userId: text("user_id").references(() => user.id),
  resumeId: text("resume_id").references(() => resume.id)
})

/**
 * Contact details, master copy (`resumeId` null) or resume snapshot.
 *
 * `fullName` and `email` are on the snapshot rather than read off `user`,
 * because a saved resume has to still say what it said when it was sent — a
 * changed name or address on the account is not a retroactive edit to it. The
 * master row leaves both null; the account's own name and email live on `user`.
 */
export const contact = pgTable("contact", {
  id: text("id").primaryKey(),
  fullName: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  linkedIn: text("linked_in"),
  portfolio: text("portfolio"),
  location: text("location").notNull(),
  userId: text("user_id").notNull(),
  resumeId: text("resume_id").references(() => resume.id)
})

export const work = pgTable("work", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  title: text("title").notNull(),
  location: text("location"),
  /** One accomplishment per entry. Rendered as the job's bullet list. */
  bullets: text("bullets").array().notNull(),
  /** Order within the Experience section. Row order was `ORDER BY id` before. */
  position: integer("position").default(0).notNull(),
  userId: text("user_id").references(() => user.id),
  resumeId: text("resume_id").references(() => resume.id)
})

export const workRelations = relations(work, ({ one }) => ({
  user: one(user, {
    fields: [work.userId],
    references: [user.id]
  }),
  resume: one(resume, {
    fields: [work.resumeId],
    references: [resume.id]
  })
}))

export const school = pgTable("school", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  degree: text("degree").notNull(),
  location: text("location"),
  gpa: text("gpa"),
  description: text("description"),
  /** Order within the Education section. */
  position: integer("position").default(0).notNull(),
  userId: text("user_id").references(() => user.id),
  resumeId: text("resume_id").references(() => resume.id)
})

export const schoolRelations = relations(school, ({ one }) => ({
  user: one(user, {
    fields: [school.userId],
    references: [user.id]
  }),
  resume: one(resume, {
    fields: [school.resumeId],
    references: [resume.id]
  })
}))

/**
 * A resume owns everything it renders.
 *
 * `introduction` and `interests` are gone: they were half-built columns nothing
 * wrote and nothing rendered, and a block of text on a resume is now a custom
 * `section` — one way to express it rather than two.
 */
export const resume = pgTable("resume", {
  id: text("id").primaryKey(),
  profession: text("profession").notNull(),
  /**
   * The posting this resume was written for, kept so the list can tell one
   * resume from another and so scoring has something to score against.
   */
  jobDescription: text("job_description").default("").notNull(),
  /**
   * The typographic direction the document is drawn in — one of
   * `~/lib/resume-style`'s names, held as `text` so a new direction is a
   * deploy rather than a migration.
   *
   * On the resume rather than on the account: a resume owns everything it
   * renders, and reading the style through to the account would mean a resume
   * already sent changes appearance after the fact.
   */
  style: text("style").default(defaultResumeStyle).notNull(),
  /**
   * The accent the style fixed when it was chosen.
   *
   * Stored rather than read from the style's CSS for the same reason: retuning
   * a direction later must not repaint a document someone already sent. There
   * is no picker for it — see the spec's out-of-scope list.
   */
  accent: text("accent")
    .default(resumeStyleCatalog[defaultResumeStyle].accent)
    .notNull(),
  userId: text("user_id").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export const resumeRelations = relations(resume, ({ one, many }) => ({
  user: one(user, {
    fields: [resume.userId],
    references: [user.id]
  }),
  experience: many(work),
  education: many(school),
  sections: many(section)
}))

/**
 * The sections a resume is made of, in the order they are drawn.
 *
 * Two kinds share the table so that `label` is a real column, so core and
 * custom sections can interleave on one comparable `position`, and so adding a
 * section is a single insert.
 *
 * - **Core** (`experience`, `education`, `skills`) carries no `content`: it is a
 *   label, an order, and a pointer to its own typed rows. Those rows are what
 *   make a resume machine-readable, so their structure is not the user's to
 *   change — only the label and the position are.
 * - **Custom** (`custom`) holds its own `content`, shaped by `componentType`.
 */
export const section = pgTable("section", {
  id: text("id").primaryKey(),
  resumeId: text("resume_id")
    .notNull()
    .references(() => resume.id, { onDelete: "cascade" }),
  /** `experience` | `education` | `skills` | `custom`. */
  kind: text("kind").notNull(),
  /** The heading as the user wants it read — "Work History", not "experience". */
  label: text("label").notNull(),
  /** How the section draws. The set is fixed; see `~/lib/section-content`. */
  componentType: text("component_type").notNull(),
  position: integer("position").notNull(),
  /** Custom sections only, validated against `componentType` on write. */
  content: jsonb("content")
})

export const sectionRelations = relations(section, ({ one }) => ({
  resume: one(resume, {
    fields: [section.resumeId],
    references: [resume.id]
  })
}))
