'use strict'

const PAID_AI_PATHS = new Set([
  '/api/ai/resegment',
  '/api/ai/review-song',
  '/api/ai/explain-sentences',
  '/api/ai/explain-selection',
])

function assertPaidAiRequest(path, senderUrl, expectedOrigin) {
  if (!PAID_AI_PATHS.has(path)) throw new Error('不允许请求这个 AI 接口。')
  try {
    if (new URL(senderUrl).origin === expectedOrigin) return
  } catch { /* rejected below */ }
  throw new Error('AI 请求来源不是当前 UTA 页面。')
}

module.exports = { assertPaidAiRequest }
