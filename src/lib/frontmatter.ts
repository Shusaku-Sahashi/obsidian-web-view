import { z } from 'astro:content';

// createdはYYYY-MM-DDが基本だが、統一漏れの「YYYY-MM-DD HH:mm」も受理する
const CREATED_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/;

const createdDate = z.union([z.string(), z.date()]).transform((raw, ctx) => {
  if (raw instanceof Date) return raw;
  const m = raw.trim().match(CREATED_RE);
  if (!m) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid created date: "${raw}"` });
    return z.NEVER;
  }
  const [, y, mo, d, hh = '00', mi = '00'] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mi));
});

const optionalStringList = z
  .array(z.string())
  .nullable()
  .optional()
  .transform((v) => v ?? []);

export const frontmatterSchema = z
  .object({
    created: createdDate,
    up: z.union([z.string(), z.array(z.string())]).nullable().optional(),
    related: z.union([z.string(), z.array(z.string())]).nullable().optional(),
    tags: optionalStringList,
    type: z.string().optional(),
    fileClass: z.string().optional(),
    status: z.string().optional(),
    isWork: z.boolean().optional(),
    aliases: optionalStringList,
  })
  .passthrough();
