import { useState } from "react"
import { Outlet } from "react-router-dom"
import Sidebar from "./Sidebar"
import TopNav from "./TopNav"

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-shell-bg flex h-screen overflow-hidden text-slate-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pt-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
