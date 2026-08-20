import { relations } from "drizzle-orm"
import {
  boolean,
  integer,
  pgTableCreator,
  text,
  timestamp
} from "drizzle-orm/pg-core"

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
 * `firstName` … `interests` came from `profile`.
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
  profession: text("profession").default("").notNull(),
  introduction: text("introduction"),
  interests: text("interests")
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

export const skill = pgTable("skill", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  all: text("all").array().notNull(),
  position: integer("position").notNull(),
  userId: text("user_id").references(() => user.id)
})

export const contact = pgTable("contact", {
  id: text("id").primaryKey(),
  phone: text("phone"),
  linkedIn: text("linked_in"),
  portfolio: text("portfolio"),
  location: text("location").notNull(),
  userId: text("user_id").notNull()
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

export const resume = pgTable("resume", {
  id: text("id").primaryKey(),
  profession: text("profession").notNull(),
  introduction: text("introduction"),
  interests: text("interests"),
  userId: text("user_id").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export const resumeRelations = relations(resume, ({ one, many }) => ({
  user: one(user, {
    fields: [resume.userId],
    references: [user.id]
  }),
  experience: many(work),
  education: many(school)
}))
