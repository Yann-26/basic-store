import type { ComponentType } from 'react'
import { FaFacebook, FaTiktok } from 'react-icons/fa6'
import type { SocialProvider } from '@trs/shared'
import GoogleLogo from './GoogleLogo'

/** Brand colours and logos of the social sign-in buttons. */
export const PROVIDER_STYLE: Record<SocialProvider, { icon: ComponentType<{ className?: string }>; className: string }> = {
  google: { icon: GoogleLogo, className: 'border border-[#dadce0] bg-[#fff] text-[#262626] hover:bg-[#f5f5f5]' },
  facebook: { icon: FaFacebook, className: 'bg-[#1877F2] text-[#fff] hover:bg-[#166FE5]' },
  tiktok: { icon: FaTiktok, className: 'bg-[#000] text-[#fff] ring-1 ring-white/15 hover:bg-[#171717]' },
}
