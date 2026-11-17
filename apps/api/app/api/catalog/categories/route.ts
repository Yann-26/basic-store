import { route } from '@/interfaces/http/handler'
import { GENDERS, PRODUCT_CATEGORIES, SIZE_SYSTEMS } from '@trs/shared'

export const GET = route(async () => ({ categories: PRODUCT_CATEGORIES, genders: GENDERS, sizeSystems: SIZE_SYSTEMS }), {
  cache: 'public, s-maxage=3600',
})
