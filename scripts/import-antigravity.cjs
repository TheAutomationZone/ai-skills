const fs = require('fs');
const path = require('path');

const targetRepoRoot = path.resolve(__dirname, '..');
const sourceRepoRoot = path.resolve(process.argv[2] || path.join(targetRepoRoot, '..', 'antigravity-awesome-skills-main'));
const sourceIndexPath = path.join(sourceRepoRoot, 'skills_index.json');
const targetSkillsDir = path.join(targetRepoRoot, 'skills');
const targetCatalogPath = path.join(targetRepoRoot, 'catalog.json');
const targetReadmePath = path.join(targetRepoRoot, 'README.md');

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }
}

function toTitleCase(value) {
  return String(value || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function unique(values) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function stripWrappingQuotes(value) {
  const text = String(value || '').trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function extractFrontmatter(markdown) {
  if (!markdown || !markdown.startsWith('---\n')) {
    return {};
  }
  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) {
    return {};
  }
  const raw = markdown.slice(4, end).split(/\r?\n/);
  const result = {};
  for (let index = 0; index < raw.length; index += 1) {
    const line = raw[index];
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, value] = match;
    const trimmed = value.trim();
    if (!trimmed) {
      const items = [];
      while (index + 1 < raw.length && /^\s*-\s+/.test(raw[index + 1])) {
        index += 1;
        items.push(stripWrappingQuotes(raw[index].replace(/^\s*-\s+/, '')));
      }
      result[key] = items;
    } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      result[key] = trimmed.slice(1, -1).split(',').map((item) => stripWrappingQuotes(item)).filter(Boolean);
    } else if (['tags', 'tools', 'aliases'].includes(key) && trimmed.includes(',')) {
      result[key] = trimmed.split(',').map((item) => stripWrappingQuotes(item)).filter(Boolean);
    } else {
      result[key] = stripWrappingQuotes(trimmed);
    }
  }
  return result;
}

function buildSummary(description, fallbackName) {
  const text = String(description || '').replace(/\s+/g, ' ').replace(/,\s*/g, ', ').trim();
  if (!text) {
    return `Specialized AI skill for ${fallbackName}.`;
  }
  const sentenceMatch = text.match(/^(.+?[.!?])(?:\s|$)/);
  const sentence = sentenceMatch ? sentenceMatch[1].trim() : text;
  return sentence.length <= 180 ? sentence : `${sentence.slice(0, 177).trimEnd()}...`;
}

function buildTags(entry, frontmatter) {
  const pathTags = String(entry.path || '')
    .split('/')
    .map((segment) => segment.trim().toLowerCase())
    .filter((segment) => segment && segment !== 'skills' && segment !== String(entry.id || '').toLowerCase());
  const fmTags = Array.isArray(frontmatter.tags)
    ? frontmatter.tags
    : typeof frontmatter.tags === 'string'
      ? frontmatter.tags.split(',')
      : [];
  return unique([
    ...(fmTags || []),
    entry.category,
    entry.risk,
    entry.source,
    ...pathTags
  ]).map((tag) => stripWrappingQuotes(tag).toLowerCase());
}

function main() {
  ensureFileExists(sourceIndexPath);
  const rawIndex = JSON.parse(fs.readFileSync(sourceIndexPath, 'utf8'));
  if (!Array.isArray(rawIndex)) {
    throw new Error('skills_index.json must contain an array');
  }

  fs.rmSync(targetSkillsDir, { recursive: true, force: true });
  fs.mkdirSync(targetSkillsDir, { recursive: true });

  const categoryCounts = new Map();
  const migrated = [];
  const missing = [];

  for (const entry of rawIndex) {
    const sourceSkillFile = path.join(sourceRepoRoot, entry.path || '', 'SKILL.md');
    if (!fs.existsSync(sourceSkillFile)) {
      missing.push(entry.id);
      continue;
    }

    const markdown = fs.readFileSync(sourceSkillFile, 'utf8');
    const frontmatter = extractFrontmatter(markdown);
    const category = stripWrappingQuotes(String(frontmatter.category || entry.category || 'uncategorized').trim()) || 'uncategorized';
    const name = stripWrappingQuotes(String(frontmatter.name || frontmatter.title || entry.name || entry.id).trim()) || String(entry.id);
    const description = String(frontmatter.description || entry.description || '').replace(/\s+/g, ' ').replace(/,\s*/g, ', ').trim();
    const summary = buildSummary(description, name);
    const tags = buildTags({ ...entry, category }, frontmatter);
    const normalizedId = String(entry.id).trim();
    const skillDir = path.join(targetSkillsDir, normalizedId);
    const skillMarkdownPath = path.join(skillDir, 'SKILL.md');
    const skillMetaPath = path.join(skillDir, 'meta.json');

    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(skillMarkdownPath, markdown, 'utf8');

    const meta = {
      id: normalizedId,
      name,
      summary,
      description,
      category,
      tags,
      risk: String(entry.risk || frontmatter.risk || 'unknown'),
      source: String(entry.source || frontmatter.source || 'community'),
      addedAt: String(entry.date_added || ''),
      version: '1.0.0',
      contentPath: `skills/${normalizedId}/SKILL.md`,
      metadataPath: `skills/${normalizedId}/meta.json`,
      upstream: {
        repo: 'antigravity-awesome-skills-main',
        path: String(entry.path || '')
      }
    };

    fs.writeFileSync(skillMetaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
    migrated.push(meta);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  migrated.sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name));
  const categories = [...categoryCounts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([id, count]) => ({ id, label: toTitleCase(id), count }));

  const catalog = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      type: 'migration',
      repo: 'antigravity-awesome-skills-main'
    },
    stats: {
      skillCount: migrated.length,
      categoryCount: categories.length,
      missingSkillFiles: missing.length
    },
    categories,
    skills: migrated
  };

  fs.writeFileSync(targetCatalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  const readme = [
    '# ai-skills',
    '',
    'Public skill catalog for AI Agent Optimizer.',
    '',
    '## Repository structure',
    '',
    '- `catalog.json`',
    '- `skills/<skill-id>/SKILL.md`',
    '- `skills/<skill-id>/meta.json`',
    '',
    '## Catalog schema',
    '',
    '- `schemaVersion`',
    '- `generatedAt`',
    '- `source`',
    '- `stats`',
    '- `categories`',
    '- `skills`',
    '',
    'Each `skills` entry includes:',
    '',
    '- `id`',
    '- `name`',
    '- `summary`',
    '- `description`',
    '- `category`',
    '- `tags`',
    '- `risk`',
    '- `source`',
    '- `addedAt`',
    '- `version`',
    '- `contentPath`',
    '- `metadataPath`',
    '- `upstream`',
    '',
    '## Current catalog stats',
    '',
    `- Skills: ${catalog.stats.skillCount}`,
    `- Categories: ${catalog.stats.categoryCount}`,
    `- Missing skill files during migration: ${catalog.stats.missingSkillFiles}`,
    '',
    'Generated from the current antigravity catalog as an initial migration source.'
  ].join('\n');

  fs.writeFileSync(targetReadmePath, `${readme}\n`, 'utf8');
  console.log(`Migrated ${migrated.length} skills into ${targetRepoRoot}`);
  if (missing.length > 0) {
    console.log(`Missing SKILL.md files for ${missing.length} catalog entries`);
  }
}

main();
