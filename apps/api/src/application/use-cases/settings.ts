import type { SettingsRepository } from '../ports'
import { ForbiddenError } from '@/domain/errors'
import { applyBrandSettings } from '../brand'

/** Keys that must never be exposed publicly nor edited through the API. */
const SECRET_KEY_PATTERN = /(password|secret|api_key|token|jwt)/i

export function makeSettingsUseCases(d: { settings: SettingsRepository }) {
  return {
    async getPublic() {
      const all = await d.settings.getAll()
      return Object.fromEntries(Object.entries(all).filter(([key]) => !SECRET_KEY_PATTERN.test(key)))
    },

    async update(entries: { key: string; value: unknown }[]) {
      const forbidden = entries.find((e) => SECRET_KEY_PATTERN.test(e.key))
      if (forbidden) throw new ForbiddenError(`Paramètre sensible non modifiable : ${forbidden.key}`)
      await d.settings.upsertMany(entries)
      // The new name/colour reach emails right away, not after the cache expires.
      applyBrandSettings(await d.settings.getAll())
    },
  }
}
