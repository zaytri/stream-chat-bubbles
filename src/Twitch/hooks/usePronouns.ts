import axios from 'axios'

const pronounsInstance = axios.create({
  baseURL: 'https://pronouns.alejo.io/api',
})

const PRONOUNS_CACHE_EXPIRE_TIME = 1000 * 60 * 5 // 5 minutes

const cache = new Map<string, CachedPronouns>()
const pronounsMap = new Map<string, string>()
let loaded = false

/**
 * Hook that returns the functions {@link loadPronounsMap}
 * and {@link getPronouns}
 */
export default function usePronouns() {
  /**
   * Takes the array of all pronouns from {@link getAllPronouns} and inserts
   * them into {@link pronounsMap} for easy read access
   */
  async function loadPronounsMap() {
    if (loaded) return // pronouns map already loaded

    const allPronouns = await getAllPronouns()
    if (!allPronouns) return // if Alejo's server is down

    allPronouns.forEach(({ name: prounounId, display: pronouns }) => {
      pronounsMap.set(prounounId, pronouns)
    })

    loaded = true
  }

  /**
   * Returns the user's pronouns, or `undefined` if they have no pronouns set
   *
   * Result is cached for 5 minutes per user
   */
  async function getPronouns(userName: string) {
    if (!loaded) return // pronouns map failed to load

    let cachedData = cache.get(userName)
    if (!cachedData || cachedData.expire < Date.now()) {
      const pronoundId = await getUserPronounId(userName)
      const pronouns = pronoundId ? pronounsMap.get(pronoundId) : undefined

      cachedData = { pronouns, expire: Date.now() + PRONOUNS_CACHE_EXPIRE_TIME }
      cache.set(userName, cachedData)
    }

    return cachedData.pronouns
  }

  return { loadPronounsMap, getPronouns }
}

/**
 * Fetch the pronoun ID of the user
 */
async function getUserPronounId(userName: string) {
  const data = await get<User[]>(`/users/${userName}`)
  if (!data) return // if Alejo's server is down

  // pronouns API returns either
  // an array that contains a single User
  // or an empty array if that user hasn't set pronouns
  const [user] = data
  if (!user) return // no pronouns set

  return user.pronoun_id
}

/**
 * Fetch the full array of {@link PronounsData}
 */
async function getAllPronouns() {
  return get<PronounsData[]>('/pronouns')
}

/**
 * Fetch data from the pronouns API, returning null on any error
 */
async function get<T>(url: string) {
  return await pronounsInstance
    .get<T>(url)
    .then(response => response.data)
    .catch(error => null)
}

type PronounsData = {
  name: string // pronoun ID
  display: string // pronouns
}

type CachedPronouns = {
  pronouns?: string
  expire: number
}

type User = {
  id: string
  login: string // username
  pronoun_id: string // maps to name in Pronouns
}