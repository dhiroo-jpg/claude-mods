import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionMeasureInput, SessionUsage } from 'claude-code'

import type { Effort, Meter, Snapshot } from '../types'

const snapshot = atom({ plugin: 'usage-band', key: 'snapshot' } as const, null)
const effortOverride = atom({ plugin: 'usage-band', key: 'effortOverride' } as const, null)
const lastEffort = atom({ plugin: 'usage-band', key: 'lastEffort' } as const, null)
const page = atom({ plugin: 'usage-band', key: 'page' } as const, 0)
const nowAtom = atom({ plugin: 'usage-band', key: 'now' } as const, 0)

const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']
const EFFORT_JA: Record<Effort, string> = { low: '低', medium: '中', high: '高', xhigh: '特高', max: '最大' }
const ACCENT = '#8b7cf6'
// カード1枚の固定部分: 枠2 + 余白2 + ラベル6 + %5 + 残り時間6 + 区切り3
const CARD_FIXED = 24
const MIN_BAR = 4
const MAX_BAR = 16
const MAX_PER_PAGE = 3

const KIND_LABEL: Record<string, string> = { five_hour: '5H', seven_day: '7D', spend_limit: 'SPEND' }

function labelOf(kind: string): string {
  return KIND_LABEL[kind] ?? kind.replace(/^seven_day_/, '').toUpperCase()
}

function toSnapshot(u: SessionUsage | SessionMeasureInput): Snapshot {
  const meters: Meter[] = u.rateLimits.map(r => ({ label: labelOf(r.kind), percent: r.percentUsed, resetsAt: r.resetsAt }))
  return { context: u.context.percent, tokens: u.context.tokens, window: u.context.window, meters, costUsd: u.cost?.usd }
}

function remaining(resetsAt: string | undefined, now: number): string {
  if (!resetsAt || !now) return ''
  const ms = Date.parse(resetsAt) - now
  if (!(ms > 0)) return '0m'
  const totalMin = Math.floor(ms / 60000)
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  if (d > 0) return `${d}d${h}h`
  if (h > 0) return `${h}h${m}m`
  return `${m}m`
}

async function refresh($: EngineInterface) {
  const u = await $.session.usage()
  const now = await $.clock.now()
  await update($, snapshot, () => toSnapshot(u))
  await update($, nowAtom, () => now)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  on('session.measure', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, snapshot, () => toSnapshot(e))
    await update($, nowAtom, () => now)
    return next(e)
  })

  // EFFORT: 選んだ値を各リクエストに適用し、実際に使われた値を記録する
  on('turn.step', async function* ($, e, next) {
    const chosen = await read($, effortOverride)
    const effective = chosen && e.effort !== undefined ? chosen : e.effort
    if (typeof effective === 'string') await update($, lastEffort, () => effective)
    return yield* next(chosen && e.effort !== undefined ? { ...e, effort: chosen } : e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const snap = await read($, snapshot)
    const now = await read($, nowAtom)
    const chosen = await read($, effortOverride)
    const seen = await read($, lastEffort)
    const current = chosen ?? seen
    const { Box, Text, Button, Link } = $.ui.resolve(e)

    // 表示幅に合わせて1ページのカード枚数とバーの長さを決める
    const cols = e.props.bodyColumns
    let perPage = MAX_PER_PAGE
    while (perPage > 1 && Math.floor((cols - (perPage - 1)) / perPage) < CARD_FIXED + MIN_BAR) perPage--
    const cardWidth = Math.max(CARD_FIXED + MIN_BAR, Math.floor((cols - (perPage - 1)) / perPage))
    const barWidth = Math.max(MIN_BAR, Math.min(MAX_BAR, cardWidth - CARD_FIXED))

    const bar = (percent: number) => {
      const filled = Math.max(0, Math.min(barWidth, Math.round((percent / 100) * barWidth)))
      const color = percent >= 90 ? 'red' : percent >= 70 ? 'yellow' : ACCENT
      return (
        <Text>
          <Text color={color}>{'█'.repeat(filled)}</Text>
          <Text dimColor>{'░'.repeat(barWidth - filled)}</Text>
        </Text>
      )
    }

    const card = (key: string, label: string, percent: number | undefined, reset: string) => (
      <Box key={key} borderStyle="round" borderDimColor paddingX={1} gap={1} width={cardWidth} flexShrink={0}>
        <Box width={6}><Text bold>{label}</Text></Box>
        {bar(percent ?? 0)}
        <Box width={5} justifyContent="flex-end">
          <Text color={ACCENT}>{percent === undefined ? '--' : `${Math.round(percent)}%`}</Text>
        </Box>
        <Box width={6} justifyContent="flex-end"><Text dimColor>{reset}</Text></Box>
      </Box>
    )

    const cards = [
      card('ctx', 'CTX', snap?.context, ''),
      ...(snap?.meters ?? []).map(m => card(`m-${m.label}`, m.label, m.percent, remaining(m.resetsAt, now))),
    ]
    if ((snap?.meters.length ?? 0) === 0) cards.push(card('m-none', '5H', undefined, 'API後'))

    const pages = Math.max(1, Math.ceil(cards.length / perPage))
    const p = Math.min(await read($, page), pages - 1)
    const shown = cards.slice(p * perPage, p * perPage + perPage)

    const idx = current ? EFFORTS.indexOf(current) : -1
    const effortCard = (
      <Box key="effort" borderStyle="round" borderDimColor paddingX={1} gap={1} alignItems="center">
        <Text bold>EFFORT</Text>
        {EFFORTS.map((lv, i) => (
          <Button
            key={`effort-${lv}`}
            label={i === idx ? '●' : i < idx ? '━' : '·'}
            plain
            dimColor={i > idx}
            onPress={() => update($, effortOverride, () => lv)}
          />
        ))}
        <Text>{current ? EFFORT_JA[current] : '既定'}</Text>
        {chosen ? <Button key="effort-reset" label="↺" plain dimColor onPress={() => update($, effortOverride, () => null)} /> : null}
      </Box>
    )

    return (
      <Box flexDirection="column">
        <Box gap={1}>{shown}</Box>
        <Box gap={1} alignItems="center">
          {effortCard}
          <Button key="prev" label="◀" plain dimColor={p === 0} onPress={() => update($, page, n => Math.max(0, n - 1))} />
          <Text dimColor>{p + 1}/{pages}</Text>
          <Button key="next" label="▶" plain dimColor={p >= pages - 1} onPress={() => update($, page, n => Math.min(pages - 1, n + 1))} />
          <Button key="refresh" label="更新" plain dimColor onPress={() => refresh($)} />
          {snap?.costUsd !== undefined ? <Text dimColor>${snap.costUsd.toFixed(2)}</Text> : null}
          <Link href="https://claude.ai/settings/usage" label="アプリ設定" />
        </Box>
      </Box>
    )
  })
}
