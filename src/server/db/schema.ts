import { relations } from "drizzle-orm"
import { pgTableCreator, text, varchar } from "drizzle-orm/pg-core"

export const pgTable = pgTableCreator((name) => `gptJob_${name}`)

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  image: text("image"),
  bio: varchar("bio", { length: 255 }),
  password: text("password").notNull()
})

export const userRelations = relations(user, ({ one }) => ({
  profile: one(profile, {
    fields: [user.id],
    references: [profile.id]
  })
}))

export const profile = pgTable("profile", {
  id: text("id").primaryKey(),
  profession: text("profession").notNull(),
  skills: text("skills").array().notNull(),
  introduction: text("profile"),
  interests: text("interests"),
  userId: text("user_id").references(() => user.id)
})

export const profileRelations = relations(profile, ({ many, one }) => ({
  experience: many(job),
  education: many(school),
  contact: one(contact, {
    fields: [profile.id],
    references: [contact.profileId]
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

export const job = pgTable("job", {
  id: text("id").primaryKey(),
  companyName: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  resumeId: text("file_id").notNull()
})

export const jobRelations = relations(job, ({ one }) => ({
  file: one(profile, {
    fields: [job.resumeId],
    references: [profile.id]
  })
}))

export const school = pgTable("school", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  degree: text("degree").notNull(),
  location: text("location").notNull(),
  gpa: text("gpa"),
  description: text("description"),
  resumeId: text("file_id").notNull()
})

export const schoolRelations = relations(school, ({ one }) => ({
  file: one(profile, {
    fields: [school.resumeId],
    references: [profile.id]
  })
}))
