import { generateUserKeys, unlockPrivateKey, type WrappedPrivateKey } from '@/lib/crypto/e2ee'
import { privateKeyName, putKey } from '@/lib/crypto/keystore'
import { supabase } from '@/lib/supabase'

export const KEYS_CHANGED = 'fh-keys-changed'

// While keys are being prepared after sign-in, the sign-in pages wait (spinner)
// instead of redirecting, so a quick refresh can't interrupt it.
let preparing = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
export const keysPreparing = {
  subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)),
  get: () => preparing > 0,
}

/**
 * Create (first time) or unlock this person's key with their password, and keep
 * it on this device. Called straight after sign-in / sign-up, before moving on,
 * so a quick refresh can't interrupt it. Returns the unlocked private key.
 */
export async function prepareKeys(userId: string, password: string): Promise<CryptoKey> {
  preparing++
  emit()
  try {
    return await prepareKeysInner(userId, password)
  } finally {
    preparing--
    emit()
  }
}

async function prepareKeysInner(userId: string, password: string): Promise<CryptoKey> {
  const { data } = await supabase.from('user_private_keys').select('wrapped_private_key, salt, iv, iterations').eq('user_id', userId).maybeSingle()
  let key: CryptoKey
  if (!data) {
    const k = await generateUserKeys(password)
    const e1 = await supabase.from('user_private_keys').upsert({ user_id: userId, ...k.wrapped })
    if (e1.error) throw e1.error
    const e2 = await supabase.from('user_public_keys').upsert({ user_id: userId, public_key: k.publicKey })
    if (e2.error) throw e2.error
    key = k.privateKey
  } else {
    key = await unlockPrivateKey(password, data as WrappedPrivateKey)
  }
  await putKey(privateKeyName(userId), key)
  window.dispatchEvent(new CustomEvent(KEYS_CHANGED))
  return key
}
