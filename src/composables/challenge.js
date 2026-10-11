import { shallowRef } from 'vue'
export const challengeState = shallowRef(null)
const queue = []
function next() { if (!challengeState.value && queue.length) challengeState.value = queue.shift() }
export function requestChallenge(base, siteKey) {
  if (!siteKey) return Promise.reject(Error('Turnstile enabled without site key'))
  return new Promise((resolve, reject) => { queue.push({base, siteKey, resolve, reject}); next() })
}
export function finishChallenge(token, error) {
  const task = challengeState.value
  if (!task) return
  challengeState.value = null
  if (error) task.reject(error); else task.resolve(token)
  next()
}
