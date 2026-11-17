import { useSettings } from '../../context/SettingsContext'
import { socialUrl } from '../../utils/constants'
import type { CommunityLook } from '../../services/engagementService'

/** The shop's Instagram profile, and where a look sends people (its post, else the profile). */
export function useInstagramProfile() {
  const { settings } = useSettings()
  const profile = socialUrl('instagram', settings.social_instagram)
  const handle = (settings.social_instagram || '')
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
    .replace(/\/$/, '')
  const linkFor = (look: CommunityLook) => look.permalink || look.post_url || profile
  return { profile, handle, linkFor }
}
