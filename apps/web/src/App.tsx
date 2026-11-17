import { Route, Routes } from 'react-router-dom'
import BrandEffects from './components/layout/BrandEffects'
import Layout from './components/layout/Layout'
import CartDrawer from './components/cart/CartDrawer'
import PageLoader from './components/ui/PageLoader'
import RequireAuth from './components/auth/RequireAuth'
import { lazyPage } from './core/lazy'
import Home from './pages/Home'
import Collection from './pages/Collection'
import Product from './pages/Product'

// Secondary storefront pages
const Cart = lazyPage(() => import('./pages/Cart'))
const Checkout = lazyPage(() => import('./pages/Checkout'))
const OrderConfirmation = lazyPage(() => import('./pages/OrderConfirmation'))
const TrackOrder = lazyPage(() => import('./pages/TrackOrder'))
const Wishlist = lazyPage(() => import('./pages/Wishlist'))
const RisingStars = lazyPage(() => import('./pages/RisingStars'))
const About = lazyPage(() => import('./pages/About'))
const FAQ = lazyPage(() => import('./pages/FAQ'))
const Contact = lazyPage(() => import('./pages/Contact'))
const Login = lazyPage(() => import('./pages/Login'))
const Register = lazyPage(() => import('./pages/Register'))
const ForgotPassword = lazyPage(() => import('./pages/ForgotPassword'))
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'))
const VerifyEmail = lazyPage(() => import('./pages/VerifyEmail'))
const SocialCallback = lazyPage(() => import('./pages/SocialCallback'))
const Unsubscribe = lazyPage(() => import('./pages/Unsubscribe'))
const Account = lazyPage(() => import('./pages/Account'))
const PayBalance = lazyPage(() => import('./pages/PayBalance'))
const PaymentCallback = lazyPage(() => import('./pages/PaymentCallback'))
const Ticket = lazyPage(() => import('./pages/Ticket'))
const NotFound = lazyPage(() => import('./pages/NotFound'))

// Admin area — its own chunk (charts etc. never reach shoppers)
const ProtectedAdminRoute = lazyPage(() => import('./components/admin/ProtectedAdminRoute'))
const AdminLayout = lazyPage(() => import('./components/layout/AdminLayout'))
const AdminLogin = lazyPage(() => import('./pages/admin/Login'))
const AdminDashboard = lazyPage(() => import('./pages/admin/Dashboard'))
const AdminProducts = lazyPage(() => import('./pages/admin/Products'))
const AdminStock = lazyPage(() => import('./pages/admin/Stock'))
const AdminCatalog = lazyPage(() => import('./pages/admin/Catalog'))
const AdminOrders = lazyPage(() => import('./pages/admin/Orders'))
const AdminOrderTicket = lazyPage(() => import('./pages/admin/OrderTicket'))
const AdminCustomers = lazyPage(() => import('./pages/admin/Customers'))
const AdminUsers = lazyPage(() => import('./pages/admin/Users'))
const AdminPayments = lazyPage(() => import('./pages/admin/Payments'))
const AdminMessages = lazyPage(() => import('./pages/admin/Messages'))
const AdminInstagram = lazyPage(() => import('./pages/admin/Instagram'))
const AdminNewsletter = lazyPage(() => import('./pages/admin/Newsletter'))
const AdminMarketing = lazyPage(() => import('./pages/admin/Marketing'))
const AdminAudience = lazyPage(() => import('./pages/admin/Audience'))
const AdminNewsletterEditor = lazyPage(() => import('./pages/admin/NewsletterEditor'))
const AdminSettings = lazyPage(() => import('./pages/admin/Settings'))

export default function App() {
  return (
    <>
      <BrandEffects />
      <CartDrawer />
      <PageLoader>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />

          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="collection" element={<Collection />} />
            <Route path="product/:id" element={<Product />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="looks" element={<RisingStars />} />
            <Route path="rising-stars" element={<RisingStars />} />
            <Route path="panier" element={<Cart />} />
            <Route
              path="commande"
              element={
                <RequireAuth reason="Connectez-vous pour finaliser votre commande.">
                  <Checkout />
                </RequireAuth>
              }
            />
            <Route path="commande/confirmation/:preorderNumber" element={<OrderConfirmation />} />
            <Route path="payment/callback" element={<PaymentCallback />} />
            <Route path="track" element={<TrackOrder />} />
            <Route path="about" element={<About />} />
            <Route path="faq" element={<FAQ />} />
            <Route path="contact" element={<Contact />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="mot-de-passe-oublie" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="verify-email" element={<VerifyEmail />} />
            <Route path="connexion/sociale" element={<SocialCallback />} />
            <Route path="desinscription" element={<Unsubscribe />} />
            <Route
              path="compte"
              element={
                <RequireAuth reason="Connectez-vous pour accéder à votre compte.">
                  <Account />
                </RequireAuth>
              }
            />
            <Route
              path="payer/:preorderNumber"
              element={
                <RequireAuth reason="Connectez-vous pour payer votre commande.">
                  <PayBalance />
                </RequireAuth>
              }
            />
            <Route
              path="compte/ticket/:preorderNumber"
              element={
                <RequireAuth reason="Connectez-vous pour voir votre ticket.">
                  <Ticket />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedAdminRoute>
                <AdminLayout />
              </ProtectedAdminRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="stock" element={<AdminStock />} />
            <Route path="catalog" element={<AdminCatalog />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id/ticket" element={<AdminOrderTicket />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="instagram" element={<AdminInstagram />} />
            <Route path="newsletter" element={<AdminNewsletter />} />
            <Route path="marketing" element={<AdminMarketing />} />
            <Route path="audience" element={<AdminAudience />} />
            <Route path="newsletter/:id" element={<AdminNewsletterEditor />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </PageLoader>
    </>
  )
}
