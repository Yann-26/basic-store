import { motion } from 'framer-motion'
import { FaWhatsapp } from 'react-icons/fa'
import { useSettings } from '../../context/SettingsContext'
import { whatsappLink } from '../../utils/constants'

export default function WhatsAppFloat() {
  const { settings } = useSettings()
  return (
    <motion.a
      href={whatsappLink(settings.store_whatsapp, `Bonjour ${settings.store_name}, j’ai une question.`)}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 1.2, type: 'spring', stiffness: 200 }}
      whileHover={{ scale: 1.04 }}
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-primary-black sm:bottom-8 sm:right-8 sm:h-16 sm:w-16"
      aria-label="Contactez-nous sur WhatsApp"
    >
      <FaWhatsapp className="h-7 w-7 text-[#25D366] sm:h-8 sm:w-8" />
    </motion.a>
  )
}
