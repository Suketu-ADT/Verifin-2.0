import { useEffect, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import { useMediaQuery, useStoredState } from "@/lib/hooks"
import { DURATION, EASE } from "@/lib/motion"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"

/** The one shell for every signed-in page: navy sidebar (collapsible rail, drawer on small screens), header, and a light content area. */
export default function Layout() {
  const { pathname } = useLocation()
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const [collapsed, setCollapsed] = useStoredState("verifin.sidebar.collapsed", false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // a new page starts at the top, and a drawer never stays open across navigation
  useEffect(() => {
    window.scrollTo({ top: 0 })
    setDrawerOpen(false)
  }, [pathname])

  return (
    <div className="flex min-h-dvh bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-md">
        Skip to content
      </a>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
        isDesktop={isDesktop}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenu={() => setDrawerOpen(true)} showMenu={!isDesktop} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.base, ease: EASE }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
