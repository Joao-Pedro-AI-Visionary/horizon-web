import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PWA manifest and service worker assets', () => {
  it('provides a complete webmanifest referencing existing PNG icons and current theme color', () => {
    const raw = readFileSync(resolve(process.cwd(), 'public', 'manifest.webmanifest'), 'utf8')
    const manifest = JSON.parse(raw) as {
      name: string
      short_name: string
      start_url: string
      display: string
      background_color: string
      theme_color: string
      icons: Array<{ src: string; sizes: string; type: string }>
    }

    expect(manifest.name).toBe('Radar by JpDev')
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.background_color).toBe('#eef2ee')
    expect(manifest.theme_color).toBe('#eef2ee')
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)

    for (const icon of manifest.icons) {
      const diskPath = resolve(process.cwd(), 'public', icon.src.replace(/^\//, ''))
      expect(existsSync(diskPath)).toBe(true)
    }
  })

  it('keeps service worker strictly bypassing /api, RSS, sitemap and OG routes', () => {
    const sw = readFileSync(resolve(process.cwd(), 'public', 'sw.js'), 'utf8')
    expect(sw).toContain("'/api/'")
    expect(sw).toContain("'/healthz'")
    expect(sw).toContain("'/rss.xml'")
    expect(sw).toContain("'/digests/rss.xml'")
    expect(sw).toContain("'/sitemap.xml'")
    expect(sw).toContain("'/og/'")
    expect(sw).toContain("request.mode === 'navigate'")
  })
})
