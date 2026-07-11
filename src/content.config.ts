import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { frontmatterSchema } from './lib/frontmatter';
import { slugForFilename } from './lib/notes-index';

const posts = defineCollection({
  loader: glob({
    pattern: '*.md',
    base: './contents',
    generateId: ({ entry }) => slugForFilename(entry),
  }),
  schema: frontmatterSchema,
});

export const collections = { posts };
