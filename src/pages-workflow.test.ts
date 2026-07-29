import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflowPath = resolve(process.cwd(), '.github/workflows/pages.yml')

describe('GitHub Pages deployment guards', () => {
  it('requires the exact configured default branch ref for both Pages publication steps', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const publicationGuards = [...workflow.matchAll(/^\s+if:\s+(.*default_branch.*)$/gm)]
      .map((match) => match[1])

    expect(publicationGuards).toHaveLength(2)
    for (const guard of publicationGuards) {
      expect(guard).toContain("github.ref == format('refs/heads/{0}', github.event.repository.default_branch)")
      expect(guard).not.toContain('github.ref_name')
    }
  })
})
