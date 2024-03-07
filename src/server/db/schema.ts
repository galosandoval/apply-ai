import { relations } from "drizzle-orm"
import { pgTableCreator, text, timestamp } from "drizzle-orm/pg-core"

export const pgTable = pgTableCreator((name) => `apply-ai_${name}`)

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  image: text("image"),
  password: text("password").notNull()
})

export const userRelations = relations(user, ({ one }) => ({
  profile: one(profile, {
    fields: [user.id],
    references: [profile.userId]
  })
}))

export const profile = pgTable("profile", {
  id: text("id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profession: text("profession").default("").notNull(),
  skills: text("skills").array().notNull(),
  introduction: text("profile"),
  interests: text("interests"),
  userId: text("user_id").references(() => user.id)
})

export const profileRelations = relations(profile, ({ many, one }) => ({
  experience: many(work),
  education: many(school),
  contact: one(contact, {
    fields: [profile.id],
    references: [contact.profileId]
  }),
  user: one(user, {
    fields: [profile.userId],
    references: [user.id]
  }),
  resumes: many(resume)
}))

export const contact = pgTable("contact", {
  id: text("id").primaryKey(),
  phone: text("phone"),
  linkedIn: text("linked_in"),
  portfolio: text("portfolio"),
  location: text("location").notNull(),
  profileId: text("profile_id").notNull()
})

export const work = pgTable("work", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  profileId: text("profile_id").references(() => profile.id),
  resumeId: text("resume_id").references(() => resume.id)
})

export const workRelations = relations(work, ({ one }) => ({
  file: one(profile, {
    fields: [work.profileId],
    references: [profile.id]
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
  profileId: text("profile_id").references(() => profile.id),
  resumeId: text("resume_id").references(() => resume.id)
})

export const schoolRelations = relations(school, ({ one }) => ({
  profile: one(profile, {
    fields: [school.profileId],
    references: [profile.id]
  }),
  resume: one(resume, {
    fields: [school.resumeId],
    references: [resume.id]
  })
}))

export const resume = pgTable("resume", {
  id: text("id").primaryKey(),
  profession: text("profession").notNull(),
  skills: text("skills").notNull(),
  introduction: text("introduction").notNull(),
  interests: text("interests"),
  profileId: text("profile_id").references(() => profile.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export const resumeRelations = relations(resume, ({ one, many }) => ({
  profile: one(profile, {
    fields: [resume.profileId],
    references: [profile.id]
  }),
  experience: many(work),
  education: many(school)
}))
