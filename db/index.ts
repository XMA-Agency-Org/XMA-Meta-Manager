import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const databaseUrl = process.env.DATABASE_URL

export const db = databaseUrl
	? drizzle(postgres(databaseUrl), { schema })
	: null

export type Database = NonNullable<typeof db>
