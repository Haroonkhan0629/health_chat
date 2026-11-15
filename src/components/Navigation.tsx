import { useState } from 'react'
import { AuthOverlay, useAuth } from 'deepspace'
import { APP_NAME } from '../constants'
import AccountMenu from './AccountMenu'

export default function Navigation() {
  const { isLoaded, isSignedIn } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  return (
    <>
      <nav data-testid="app-navigation" className="border-b border-border bg-background">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-4 px-4">
          <span className="text-sm font-semibold text-foreground">{APP_NAME}</span>
          <div className="flex-1" />
          {isLoaded && (isSignedIn ? (
            <AccountMenu onSignOut={() => setShowAuth(false)} />
          ) : (
            <button
              data-testid="nav-sign-in-button"
              onClick={() => setShowAuth(true)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Sign in
            </button>
          ))}
        </div>
      </nav>
      {showAuth && !isSignedIn && <AuthOverlay onClose={() => setShowAuth(false)} />}
    </>
  )
}
