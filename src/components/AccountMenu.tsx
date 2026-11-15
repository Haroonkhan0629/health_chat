import { useState } from 'react'
import { signOut, useAuthUser } from 'deepspace'
import { ChevronDown, LogOut } from 'lucide-react'
import {
  Avatar, AvatarFallback, AvatarImage,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui'

export default function AccountMenu({ onSignOut }: { onSignOut?: () => void }) {
  const { isLoaded, isSignedIn, user } = useAuthUser()
  const [error, setError] = useState('')

  async function handleSignOut() {
    setError('')
    onSignOut?.()
    try {
      const result = await signOut()
      if (result.error) throw new Error(result.error.message || 'Could not sign out.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out.')
    }
  }

  if (!isLoaded || !isSignedIn) return null
  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Signed in'
  const email = user?.primaryEmailAddress?.emailAddress
  return (
    <div className="account-menu">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button aria-label="Account menu" className="account-trigger">
              <Avatar className="h-6 w-6">
                <AvatarImage src={user?.imageUrl ?? undefined} referrerPolicy="no-referrer" />
                <AvatarFallback>{name[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <span data-testid="nav-user-name">{name}</span>
              <ChevronDown size={16} aria-hidden />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div>{name}</div>
            {email && <div data-testid="nav-user-email" className="text-xs text-muted-foreground">{email}</div>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut aria-hidden /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <div role="alert" className="account-error">{error}</div>}
    </div>
  )
}
