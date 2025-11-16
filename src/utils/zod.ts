import { z } from "zod";

export function withTimestamps<
	T extends z.ZodRawShape
>(schema: z.ZodObject<T>) {
	return schema.extend({
		createdAt: z.coerce.date(),
		updatedAt: z.coerce.date(),
	});
}

export function toOptional<T>(item: z.ZodType<T>) {
	return item.nullish().transform((x) => x ?? null);
}
