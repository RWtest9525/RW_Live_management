import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import usePortalStore from '../store/usePortalStore'
import Logo from '../components/Logo'
import { shouldPollAppsForSync } from '../utils/appSync'

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011-1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  )},
  { label: 'Money Tracker', path: '/money-tracker', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
      <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
    </svg>
  )},
  { label: 'App Monitor', path: '/app-monitor', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm2 1a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V7a1 1 0 00-1-1H5z" clipRule="evenodd" />
    </svg>
  )},
  { label: 'Proof Gallery', path: '/proof-gallery', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
    </svg>
  )},
  { label: 'Billing', path: '/billing', userOnly: true, icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
      <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h4a1 1 0 100-2H9z" clipRule="evenodd" />
    </svg>
  )},
  { label: 'Manage Subscriptions', path: '/admin-subscriptions', adminOnly: true, icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
      <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zm-8 1a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1H8a1 1 0 110-2h1v-1a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
  )},
  { label: 'Client Management', path: '/clients', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a7 7 0 00-7 7v1h11v-1a7 7 0 00-7-7z" />
    </svg>
  )},
  { label: 'Password Requests', path: '/password-requests', adminOnly: true, icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  )},
  { label: 'Worker Panel', path: '/worker-panel', adminOnly: true, icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
    </svg>
  )},
  { label: 'Forgot Password', path: '/support/forgot-password', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  )},
  { label: 'Maintenance Mode', path: '/admin-maintenance', adminOnly: true, icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.724 1.724 0 00-2.57 1.25c-.77.29-1.56-.52-2.12-.08l-.29.29c-.44.56.37 1.35.08 2.12c-.22.56-.76.92-1.25 1.25-1.56.38-1.56 2.6 0 2.98.29.77-.52 1.56-.08 2.12l.29.29c.56.44 1.35-.37 2.12-.08.56.22.92.76 1.25 1.25.38 1.56 2.6 1.56 2.98 0a1.724 1.724 0 002.57-1.25c.77-.29 1.56.52 2.12.08l.29-.29c.44-.56-.37-1.35-.08-2.12.22-.56.76-.92 1.25-1.25 1.56-.38 1.56-2.6 0-2.98-.29-.77.52-1.56.08-2.12l-.29-.29c-.56-.44-1.35.37-2.12.08-.56-.22-.92-.76-1.25-1.25-.38-1.56-2.6-1.56-2.98 0zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  )},
]

function PortalLayout() {
  const logout = usePortalStore((state) => state.logout)
  const currentUser = usePortalStore((state) => state.currentUser)
  const loadInitialData = usePortalStore((state) => state.loadInitialData)
  const fetchLocalReviews = usePortalStore((state) => state.fetchLocalReviews)
  const isAuthenticated = usePortalStore((state) => state.isAuthenticated)
  const theme = usePortalStore((state) => state.theme)
  const toggleTheme = usePortalStore((state) => state.toggleTheme)
  const navigate = useNavigate()
  const location = useLocation()
  
  const fetchMaintenanceStatus = usePortalStore((state) => state.fetchMaintenanceStatus)
  const maintenanceActive = usePortalStore((state) => state.maintenanceActive)
  const maintenanceEndTime = usePortalStore((state) => state.maintenanceEndTime)
  const maintenanceMessage = usePortalStore((state) => state.maintenanceMessage)
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('rw_sidebar_collapsed') === 'true'
  })

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('rw_sidebar_collapsed', String(next))
      return next
    })
  }

  // Poll maintenance status
  useEffect(() => {
    fetchMaintenanceStatus()
    const id = setInterval(() => {
      fetchMaintenanceStatus()
    }, 15000)
    return () => clearInterval(id)
  }, [fetchMaintenanceStatus])

  useEffect(() => {
    if (!isAuthenticated) return undefined
    const id = setInterval(() => {
      if (shouldPollAppsForSync(usePortalStore.getState().apps)) {
        if (location.pathname.startsWith('/app/')) {
          const appId = location.pathname.split('/')[2]
          if (appId) {
            void fetchLocalReviews(appId)
          }
        } else {
          void loadInitialData()
        }
      }
    }, 8000)
    return () => clearInterval(id)
  }, [fetchLocalReviews, isAuthenticated, loadInitialData, location.pathname])

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout()
      navigate('/login')
    }
  }

  const filteredNavItems = navItems.filter((item) => {
    if (item.adminOnly && currentUser?.role !== 'admin') return false
    if (item.userOnly && currentUser?.role !== 'user') return false
    return true
  })

  const displayNavItems = filteredNavItems.slice(0, 4)
  const showMoreButton = filteredNavItems.length > 4

  // If maintenance is active and the logged-in user is not admin, render the full screen overlay page
  if (maintenanceActive && currentUser?.role !== 'admin') {
    return <MaintenanceUserView endTime={maintenanceEndTime} message={maintenanceMessage} />
  }

  // Intercept if account status is pending
  if (currentUser?.status === 'pending' && currentUser?.role !== 'admin') {
    return <PendingUserView user={currentUser} handleLogout={() => { logout(); navigate('/login'); }} />
  }

  // Intercept if account status is rejected
  if (currentUser?.status === 'rejected' && currentUser?.role !== 'admin') {
    return <RejectedUserView user={currentUser} handleLogout={() => { logout(); navigate('/login'); }} />
  }

  // Intercept if account is deactivated or not active
  if (currentUser?.status !== 'active' && currentUser?.role !== 'admin') {
    return <DeactivatedUserView user={currentUser} handleLogout={() => { logout(); navigate('/login'); }} />
  }

  return (
    <div className={`flex min-h-screen transition-colors duration-200 ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex ${isSidebarCollapsed ? 'w-20 p-3' : 'w-64 p-5'} border-r flex-col transition-all duration-300 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'} sticky top-0 h-screen`}>
        <div className="flex-1 overflow-y-auto">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} mb-8`}>
            <Logo className="h-10 w-10 flex-shrink-0" />
            {!isSidebarCollapsed && (
              <h1 className={`text-xl font-black uppercase tracking-tighter truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Review World
              </h1>
            )}
          </div>
          <nav className="space-y-1">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                title={isSidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                      : theme === 'dark'
                        ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <div className="flex-shrink-0">{item.icon}</div>
                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
            
            <button
              onClick={toggleTheme}
              title={isSidebarCollapsed ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                theme === 'dark'
                  ? 'text-yellow-400 hover:bg-slate-800'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {theme === 'dark' ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                  {!isSidebarCollapsed && <span className="truncate">Light Mode</span>}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                  {!isSidebarCollapsed && <span className="truncate">Dark Mode</span>}
                </>
              )}
            </button>
          </nav>
        </div>

        <div className="mt-auto space-y-4 pt-4 border-t border-slate-800/20">
          {/* Collapse/Expand Toggle Button */}
          <button
            type="button"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? 'Expand Menu' : 'Collapse Menu'}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} rounded-lg px-3 py-2 text-sm font-bold transition-all ${
              theme === 'dark'
                ? 'text-slate-400 hover:bg-slate-800'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {isSidebarCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="truncate">Collapse Menu</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            title={isSidebarCollapsed ? 'Logout' : undefined}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} rounded-lg px-3 py-2 text-sm font-bold transition-all ${
              theme === 'dark'
                ? 'text-rose-400 hover:bg-rose-500/10'
                : 'text-rose-600 hover:bg-rose-50'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!isSidebarCollapsed && <span className="truncate">Logout</span>}
          </button>
          
          <div className="flex items-center justify-center pt-2 opacity-30">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {isSidebarCollapsed ? 'v2' : 'Reviews World v2.0'}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile App View (Bottom Bar & Modern Layout) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen relative">
        {/* Mobile App Header */}
        <header className={`md:hidden flex items-center justify-between px-4 py-2.5 sticky top-0 z-40 ${theme === 'dark' ? 'bg-slate-950/80' : 'bg-white/80'} backdrop-blur-xl border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8 flex-shrink-0" />
            <div>
              <h2 className={`text-sm font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>RW Monitor</h2>
              <div className="flex items-center gap-1">
                <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">System Live</span>
              </div>
            </div>
          </div>
          <button 
            onClick={toggleTheme}
            className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'bg-slate-900 text-yellow-400 border border-slate-800' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707-.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </header>

        {/* Desktop Header */}
        <header className={`hidden md:flex items-center justify-between border-b px-6 py-4 transition-colors duration-200 sticky top-0 z-30 ${theme === 'dark' ? 'border-slate-800 bg-slate-900/80 backdrop-blur-md' : 'border-slate-200 bg-white/80 backdrop-blur-md'}`}>
          <div className="flex flex-col">
            <p className={`text-lg font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Management Portal</p>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
              {currentUser?.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex flex-col items-end mr-2`}>
              <p className={`text-xs font-black uppercase ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{currentUser?.name}</p>
              <p className={`text-[8px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded-full ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>{currentUser?.role}</p>
            </div>
            <div className={`h-10 w-10 rounded-full border-2 border-blue-500/20 flex items-center justify-center font-black text-sm ${theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}`}>
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
          </div>
        </header>
        
        {/* Main Content Scroll Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 scroll-smooth">
          <Outlet />
        </main>

        {/* Mobile App Bottom Tab Bar */}
        <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe border-t shadow-2xl transition-all duration-300 ${
          theme === 'dark' ? 'bg-slate-900/95 border-slate-800 shadow-slate-950/50' : 'bg-white/95 border-slate-200 shadow-slate-200/50'
        } backdrop-blur-xl flex items-center justify-around h-16 px-2`}>
          {displayNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 transition-all duration-300 ${
                  isActive
                    ? 'text-blue-500'
                    : theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              <div className="p-1 rounded-xl">
                {item.icon}
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider">{item.label.split(' ')[0]}</span>
            </NavLink>
          ))}
          
          {showMoreButton && (
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className={`flex flex-col items-center justify-center flex-1 py-1 ${theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <div className="p-1 rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider">Menu</span>
            </button>
          )}
        </nav>

        {/* Mobile App Fullscreen Overlay Menu (For "More" options) */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-[60] animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)} />
            <div className={`absolute bottom-0 left-0 right-0 rounded-t-[40px] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom-full duration-500 ${theme === 'dark' ? 'bg-slate-900 border-t border-slate-800' : 'bg-white border-t border-slate-200'}`}>
              <div className="flex items-center justify-between mb-8">
                <h3 className={`text-xl font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Menu</h3>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-full bg-slate-800/50 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {filteredNavItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-4 p-4 rounded-3xl border transition-all ${
                      theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-blue-500">{item.icon}</div>
                    <span className="text-xs font-black uppercase tracking-tight">{item.label}</span>
                  </NavLink>
                ))}
                
                <button
                  onClick={handleLogout}
                  className={`col-span-2 flex items-center justify-center gap-3 p-5 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-black uppercase tracking-widest mt-4`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout Session
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MaintenanceUserView({ endTime, message }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const updateTimer = () => {
      const diff = endTime - Date.now()
      if (diff <= 0) {
        setTimeLeft('00:00:00')
        return
      }

      const totalSecs = Math.floor(diff / 1000)
      const hrs = Math.floor(totalSecs / 3600)
      const mins = Math.floor((totalSecs % 3600) / 60)
      const secs = totalSecs % 60

      const format = (num) => String(num).padStart(2, '0')
      setTimeLeft(`${format(hrs)}:${format(mins)}:${format(secs)}`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [endTime])

  const formatExpectedOpening = (ts) => {
    if (!ts) return ''
    const date = new Date(ts)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const day = date.getDate()
    const month = months[date.getMonth()]
    let hrs = date.getHours()
    const mins = String(date.getMinutes()).padStart(2, '0')
    const ampm = hrs >= 12 ? 'PM' : 'AM'
    hrs = hrs % 12
    hrs = hrs ? hrs : 12
    return `${day} ${month}, ${hrs}:${mins} ${ampm}`
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08040d] px-4 py-8 text-white w-full">
      <div className="absolute -left-20 bottom-0 h-[420px] w-[420px] rounded-full bg-violet-600/25 blur-3xl" />
      <div className="absolute -right-24 top-0 h-[430px] w-[430px] rounded-full bg-amber-400/20 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_24%)]" />

      <div className="relative z-10 w-full max-w-lg rounded-[2.5rem] border border-white/12 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/80 backdrop-blur-2xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-xl shadow-indigo-950/50">
          <Logo className="h-12 w-12 text-white" />
        </div>

        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-400">
          App Under Maintenance
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          We will be back soon
        </h1>
        <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-300">
          {message}
        </p>

        <div className="mt-8 rounded-2xl bg-black/45 p-6 border border-white/5 shadow-inner">
          <p className="font-mono text-5xl font-black tracking-wider text-white">
            {timeLeft || '00:00:00'}
          </p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            Remaining Time
          </p>
          
          <div className="mt-4 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-pulse w-full" />
          </div>
        </div>

        {endTime && (
          <div className="mt-6 border-t border-white/5 pt-4 text-xs font-bold text-slate-400">
            Expected opening: <span className="text-white">{formatExpectedOpening(endTime)}</span>
          </div>
        )}
      </div>
    </main>
  )
}

function PendingUserView({ user, handleLogout }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08040d] px-4 py-8 text-white w-full">
      <div className="absolute -left-20 bottom-0 h-[420px] w-[420px] rounded-full bg-violet-600/25 blur-3xl" />
      <div className="absolute -right-24 top-0 h-[430px] w-[430px] rounded-full bg-amber-400/20 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_24%)]" />

      <div className="relative z-10 w-full max-w-2xl rounded-[2.5rem] border border-white/12 bg-white/[0.04] p-8 sm:p-10 text-center shadow-2xl shadow-black/80 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-500">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-300 shadow-xl shadow-amber-950/50">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-950" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>

        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-400">
          Verification Pending
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Account Under Review
        </h1>
        <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-300 max-w-md mx-auto">
          Hello <span className="text-white font-bold">{user.name}</span> (<span className="text-slate-400">{user.email}</span>), your registration is pending manual verification by our administrators. This prevents spam accounts and protects our platform's automated features.
        </p>

        {/* Visual Progress Steps */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3 text-left">
          <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-450">Step 1</p>
              <p className="text-xs font-bold text-white">Signed Up</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.04] border border-amber-500/25 p-4 flex items-center gap-3 shadow-lg shadow-amber-950/20">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">Step 2</p>
              <p className="text-xs font-bold text-white">Under Review</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.01] border border-white/[0.02] p-4 flex items-center gap-3 opacity-60">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-slate-500 border border-white/5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Step 3</p>
              <p className="text-xs font-bold text-slate-400">Live Dashboard</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 border-t border-white/5 pt-6">
          <p className="text-xs font-bold text-slate-450">
            Approved accounts get instant control desk access. Please check back later.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-rose-500/10 to-rose-600/20 px-6 py-3 text-xs font-black uppercase tracking-widest text-rose-300 border border-rose-500/30 shadow-lg transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
            Logout Session
          </button>
        </div>
      </div>
    </main>
  )
}

function RejectedUserView({ user, handleLogout }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08040d] px-4 py-8 text-white w-full">
      <div className="absolute -left-20 bottom-0 h-[420px] w-[420px] rounded-full bg-rose-950/20 blur-3xl" />
      <div className="absolute -right-24 top-0 h-[430px] w-[430px] rounded-full bg-violet-600/15 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.06),transparent_24%)]" />

      <div className="relative z-10 w-full max-w-lg rounded-[2.5rem] border border-white/12 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/80 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-500">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-rose-600 to-rose-400 shadow-xl shadow-rose-950/50">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-400">
          Access Rejected
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Request Declined
        </h1>
        <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-300">
          Hello <span className="text-white font-bold">{user.name}</span>, unfortunately, your request for an account on Reviews World has been declined by the system administrators. If you believe this is a mistake, please contact support to appeal the decision.
        </p>

        <div className="mt-8 flex flex-col gap-4 border-t border-white/5 pt-6">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl bg-rose-500/10 border border-rose-500/25 py-3 text-sm font-black uppercase tracking-widest text-rose-300 hover:bg-rose-500/20 transition"
          >
            Logout Session
          </button>
        </div>
      </div>
    </main>
  )
}

function DeactivatedUserView({ user, handleLogout }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08040d] px-4 py-8 text-white w-full">
      <div className="absolute -left-20 bottom-0 h-[420px] w-[420px] rounded-full bg-slate-900/40 blur-3xl" />
      <div className="absolute -right-24 top-0 h-[430px] w-[430px] rounded-full bg-violet-600/15 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.06),transparent_24%)]" />

      <div className="relative z-10 w-full max-w-lg rounded-[2.5rem] border border-white/12 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/80 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-500">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-800 shadow-xl border border-white/10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
          Account Suspended
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Account Deactivated
        </h1>
        <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-300">
          Hello <span className="text-white font-bold">{user.name}</span>, your control desk account is currently deactivated. Please get in touch with the administration team to reactivate your access.
        </p>

        <div className="mt-8 flex flex-col gap-4 border-t border-white/5 pt-6">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl bg-white/5 border border-white/10 py-3 text-sm font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 transition"
          >
            Logout Session
          </button>
        </div>
      </div>
    </main>
  )
}

export default PortalLayout
