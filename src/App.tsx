import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { AppShell } from '@/components/layout/AppShell'
import { FullScreenSpinner, Spinner } from '@/components/ui/Spinner'
import { useFamily } from '@/family/FamilyProvider'
import { getPendingInvite, setPendingInvite } from '@/pages/auth/AuthLayout'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import SignIn from '@/pages/auth/SignIn'
import SignUp from '@/pages/auth/SignUp'
import ComingSoon from '@/pages/ComingSoon'
import Today from '@/pages/Today'
import Welcome from '@/pages/Welcome'

const TasksPage = lazy(() => import('@/features/tasks/TasksPage'))
const Categories = lazy(() => import('@/pages/more/Categories'))
const More = lazy(() => import('@/pages/more/More'))
const Profile = lazy(() => import('@/pages/more/Profile'))
const FamilyMembers = lazy(() => import('@/pages/more/FamilyMembers'))
const FamilySettings = lazy(() => import('@/pages/more/FamilySettings'))
const Privacy = lazy(() => import('@/pages/more/Privacy'))
const InstallHelp = lazy(() => import('@/pages/more/InstallHelp'))

/** Signed-out only pages (sign in / sign up). */
function PublicOnly() {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  return session ? <Navigate to="/" replace /> : <Outlet />
}

function RequireAuth() {
  const { session, loading, recovering } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  if (recovering && location.pathname !== '/reset-password') return <Navigate to="/reset-password" replace />
  return <Outlet />
}

function RequireFamily() {
  const { family, me, loading, loadError, refresh } = useFamily()
  if (loadError)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-5xl" aria-hidden>
          📡
        </p>
        <p className="text-xl font-bold">Can’t reach Family Hub</p>
        <p className="max-w-xs text-ink-3">Check your internet connection. Once you’ve opened the app online, it works offline too.</p>
        <button onClick={() => refresh()} className="min-h-12 rounded-2xl bg-brand-500 px-6 font-semibold text-white">
          Try again
        </button>
      </div>
    )
  if (loading) return <FullScreenSpinner />
  if (!family || !me || getPendingInvite()) return <Navigate to="/welcome" replace />
  return <Outlet />
}

/** /join/ABCD2345 — remember the code, then sign up / sign in / join. */
function JoinLink() {
  const { code } = useParams()
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (loading) return
    const clean = (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    setPendingInvite(clean || null)
    navigate(session ? `/welcome?code=${clean}` : '/signup', { replace: true })
  }, [code, session, loading, navigate])
  return <FullScreenSpinner />
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
        <Route path="/join/:code" element={<JoinLink />} />
        <Route element={<PublicOnly />}>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route element={<RequireFamily />}>
            <Route element={<AppShell />}>
              <Route index element={<Today />} />
              <Route
                path="tasks"
                element={
                  <Suspense fallback={<Spinner />}>
                    <TasksPage />
                  </Suspense>
                }
              />
              <Route path="calendar" element={<ComingSoon title="Calendar" emoji="📅" phase={3} />} />
              <Route path="food" element={<ComingSoon title="Food & Drink" emoji="🍝" phase={4} />} />
              <Route
                path="more/*"
                element={
                  <Suspense fallback={<Spinner />}>
                    <Routes>
                      <Route index element={<More />} />
                      <Route path="profile" element={<Profile />} />
                      <Route path="family" element={<FamilyMembers />} />
                      <Route path="family-settings" element={<FamilySettings />} />
                      <Route path="privacy" element={<Privacy />} />
                      <Route path="install" element={<InstallHelp />} />
                      <Route path="categories" element={<Categories />} />
                      <Route path="*" element={<Navigate to="/more" replace />} />
                    </Routes>
                  </Suspense>
                }
              />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
