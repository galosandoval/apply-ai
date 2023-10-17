import { relations } from "drizzle-orm"
import { pgTableCreator, text } from "drizzle-orm/pg-core"

export const pgTable = pgTableCreator((name) => `gptJob_${name}`)

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  image: text("image"),
  password: text("password").notNull()
})

export const userRelations = relations(user, ({ one, many }) => ({
  profile: one(profile, {
    fields: [user.id],
    references: [profile.userId]
  }),
  resumes: many(resume)
}))

export const profile = pgTable("profile", {
  id: text("id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profession: text("profession"),
  skills: text("skills").array(),
  introduction: text("profile"),
  interests: text("interests"),
  userId: text("user_id")
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
  })
}))

export const contact = pgTable("contact", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  urls: text("urls").array().notNull(),
  location: text("location").notNull(),
  profileId: text("profile_id").notNull()
})

export const work = pgTable("work", {
  id: text("id").primaryKey(),
  companyName: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  profileId: text("profile_id")
})

export const workRelations = relations(work, ({ one }) => ({
  file: one(profile, {
    fields: [work.profileId],
    references: [profile.id]
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
  profileId: text("profile_id")
})

export const schoolRelations = relations(school, ({ one }) => ({
  file: one(profile, {
    fields: [school.profileId],
    references: [profile.id]
  })
}))

export const resume = pgTable("resume", {
  id: text("id").primaryKey(),
  jobDescription: text("job_description").notNull(),
  profession: text("profession").notNull(),
  skills: text("skills").notNull(),
  introduction: text("introduction"),
  interests: text("interests"),
  experience: text("experience").notNull(),
  education: text("education").notNull(),
  contact: text("contact").notNull(),
  userId: text("user_id").references(() => user.id)
})

export const resumeRelations = relations(resume, ({ one }) => ({
  user: one(user, {
    fields: [resume.userId],
    references: [user.id]
  })
}))
