# ai-skills

Public skill catalog for AI Agent Optimizer.

## Repository structure

- `catalog.json`
- `skills/<skill-id>/SKILL.md`
- `skills/<skill-id>/meta.json`

## Catalog schema

- `schemaVersion`
- `generatedAt`
- `source`
- `stats`
- `categories`
- `skills`

Each `skills` entry includes:

- `id`
- `name`
- `summary`
- `description`
- `category`
- `tags`
- `risk`
- `source`
- `addedAt`
- `version`
- `contentPath`
- `metadataPath`
- `upstream`

## Current catalog stats

- Skills: 1326
- Categories: 56
- Missing skill files during migration: 0

Generated from the current antigravity catalog as an initial migration source.
