import User from '../models/User.js'
import AiUsageLog from '../models/AiUsageLog.js'

function startOfUtcDay(d) {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

function startOfUtcMonth(d) {
  const x = new Date(d)
  x.setUTCDate(1)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

/**
 * @returns {Promise<{ status: number, message: string } | null>}
 */
export async function assertAiAccess(req, feature) {
  if (!req.user?._id) return null
  const user = await User.findById(req.user._id).select('banned aiQuota')
  if (!user) return { status: 401, message: 'User not found' }
  if (user.banned) return { status: 403, message: 'Account suspended' }
  const disabled = user.aiQuota?.disabledFeatures || []
  if (disabled.includes('*') || disabled.includes(feature)) {
    return { status: 403, message: 'This AI feature is disabled for your account.' }
  }
  const dayStart = startOfUtcDay(new Date())
  const monthStart = startOfUtcMonth(new Date())
  if (user.aiQuota?.dailyTokenLimit != null) {
    const agg = await AiUsageLog.aggregate([
      { $match: { userId: user._id, createdAt: { $gte: dayStart } } },
      { $group: { _id: null, t: { $sum: '$tokensEstimate' } } },
    ])
    const used = agg[0]?.t || 0
    if (used >= user.aiQuota.dailyTokenLimit) {
      return { status: 429, message: 'Daily AI usage limit reached. Try again tomorrow.' }
    }
  }
  if (user.aiQuota?.monthlyRequestLimit != null) {
    const count = await AiUsageLog.countDocuments({
      userId: user._id,
      createdAt: { $gte: monthStart },
    })
    if (count >= user.aiQuota.monthlyRequestLimit) {
      return { status: 429, message: 'Monthly AI request limit reached.' }
    }
  }
  return null
}

export async function logAiUsage(userId, feature, tokensEstimate = 0, meta = null) {
  if (!userId) return
  await AiUsageLog.create({
    userId,
    feature,
    tokensEstimate: Math.max(0, Math.min(tokensEstimate, 100000)),
    meta,
  })
}

export function estimateTokensFromText(text) {
  if (!text || typeof text !== 'string') return 100
  return Math.min(12000, Math.max(50, Math.ceil(text.length / 4)))
}
