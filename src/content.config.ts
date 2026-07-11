import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { frontmatterSchema } from './lib/frontmatter';
import { syncContentStaging } from './lib/content-staging';

// ステージングディレクトリのファイル名は既にslugそのもの（${slug}.md）
const stagingDir = syncContentStaging();

const posts = defineCollection({
  loader: glob({
    pattern: '*.md',
    base: stagingDir,
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: frontmatterSchema,
});

export const collections = { posts };
