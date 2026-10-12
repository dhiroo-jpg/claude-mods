import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 19 } },
} as const

test('使用量カードとEFFORTを描き、EFFORTの選択を記録する', async ($, on) => {
  mock.clock(on)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  await $.session.measure({
    context: { tokens: 88000, window: 200000, percent: 44 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 55, resetsAt: new Date(Date.now() + 30 * 60000).toISOString() },
      { kind: 'seven_day', percentUsed: 7, resetsAt: new Date(Date.now() + 6 * 86400000).toISOString() },
    ],
    changed: ['context', 'rateLimits'],
  } as never)

  for (const [surface, bodyColumns] of [['terminal', 120], ['desktop', 120], ['terminal', 70], ['desktop', 40]] as const) {
    const ui = await $.ui.mount({ plugin: 'usage-band', surface, ...BAND, props: { ...BAND.props, bodyColumns } } as never)
    expect(await ui.find({ type: 'Text', text: '44%' })).toBeDefined()
    if (bodyColumns >= 70) expect(await ui.find({ type: 'Text', text: '55%' })).toBeDefined()
    await ui.press({ key: 'effort-high' })
    expect(await ui.find({ type: 'Text', text: '高' })).toBeDefined()
    await ui.press({ key: 'effort-reset' })
    await ui.unmount()
  }
})
