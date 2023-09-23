import { pgTableCreator, text, varchar } from "drizzle-orm/pg-core";

export const pgTable = pgTableCreator((name) => `gptJob_${name}`);

export const users = pgTable("user", {
  id: text("id").notNull().primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  image: text("image"),
  bio: varchar("bio", { length: 255 }),
  password: text("password").notNull(),
});
