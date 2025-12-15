import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "../lib/db";

migrate(db, { migrationsFolder: "./drizzle" });
console.log("🚀 Migration completed");
