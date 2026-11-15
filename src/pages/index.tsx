import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthOverlay, DeepSpaceAuthProvider, getAuthToken, signOut, useAuth } from 'deepspace'
import { exercises, workoutSchema } from '../exercises'
import type { Workout } from '../exercises'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

export default function Landing() {
  return (
    <DeepSpaceAuthProvider>
      <LandingContent />
    </DeepSpaceAuthProvider>
  )
}

function LandingContent() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  async function handleSignOut() {
    setSignOutError('')
    setShowAuth(false)
    try {
      const result = await signOut()
      if (result.error) throw new Error(result.error.message || 'Could not sign out.')
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Could not sign out.')
    }
  }

  return (
    <>
      <Seo {...seo} path="/" />
      <main className="health-app">
        <div className="container health-container">
          <div className="brand">
            <span className="brand-mark">+</span> HEALTH CHAT
            {isLoaded && isSignedIn && (
              <button className="btn sign-out-button" type="button" onClick={handleSignOut}>
                Sign out
              </button>
            )}
          </div>
          <section className="hero text-center" data-testid="static-landing">
            <p className="eyebrow">YOUR GOALS. YOUR PLAN.</p>
            <h1>Build a stronger <span>you.</span></h1>
            <p className="hero-copy">
              Tell us the body part or muscle groups you want to grow.
              We&apos;ll make you a simple weekly workout plan.
            </p>
            {!isLoaded ? (
              <p role="status">Checking your sign-in...</p>
            ) : !isSignedIn ? (
              <button className="btn plan-button" type="button" onClick={() => setShowAuth(true)}>
                Sign in with DeepSpace
              </button>
            ) : (
              <WorkoutForm key={userId} />
            )}
            {signOutError && <div className="alert alert-warning mx-auto mt-4 error-message" role="alert">{signOutError}</div>}
          </section>
          <footer>AI-generated fitness guidance, not medical advice. Stop if you feel pain.</footer>
        </div>
      </main>
      {showAuth && !isSignedIn && (
        <AuthOverlay
          title="Sign in to Health Chat"
          description="Sign in to create a workout plan."
          onClose={() => setShowAuth(false)}
        />
      )}
    </>
  )
}

function WorkoutForm() {
  const [input, setInput] = useState('')
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setWorkout(null)
    setLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Your session could not be verified. Please sign in again.')
      const response = await fetch('/api/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input }),
      })
      const data: unknown = await response.json()
      if (!response.ok) {
        const message = typeof data === 'object' && data !== null && 'error' in data
          && typeof data.error === 'string' ? data.error : 'Could not generate a workout.'
        throw new Error(message)
      }
      const result = workoutSchema.safeParse(data)
      if (!result.success) throw new Error('The workout service returned an invalid response.')
      setWorkout(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to the workout service.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
            <form onSubmit={submit} className="search-form mx-auto">
              <label className="visually-hidden" htmlFor="goal">Body part or exercise goal</label>
              <div className="search-box">
                <span className="search-icon" aria-hidden="true">⌕</span>
                <input
                  id="goal"
                  className="form-control"
                  placeholder="Try chest, legs, or back and biceps"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  maxLength={300}
                  required
                />
                <button className="btn plan-button" disabled={loading} type="submit">
                  {loading ? 'Creating...' : 'Create my plan'} <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
            <p className="example-text">A little direction goes a long way.</p>
            {error && <div className="alert alert-warning mx-auto mt-4 error-message" role="alert">{error}</div>}

          {workout && (
            <section className="results" aria-live="polite">
              <div className="results-heading">
                <p className="eyebrow">MADE FOR YOU</p>
                <h2>Your week, mapped out.</h2>
                <p>Start light, focus on form, and make time to recover.</p>
              </div>
              <div className="row g-3">
                {workout.days.map((day) => (
                  <div className="col-md-6 col-xl-4" key={day.day}>
                    <article className="day-card h-100">
                      <p className="day-label">{day.day}</p>
                      <h3>{day.title}</h3>
                      <p className="day-note">{day.note}</p>
                      {day.exercises.map((exercise, index) => {
                        const detail = exercises[exercise.id]
                        return (
                          <div className="exercise" key={`${exercise.id}-${index}`}>
                            <img
                              src={detail.image}
                              alt={`Illustration of ${detail.name}`}
                              loading="lazy"
                            />
                            <div>
                              <h4>{detail.name}</h4>
                              <p>{exercise.sets} sets · {exercise.reps} reps</p>
                            </div>
                          </div>
                        )
                      })}
                    </article>
                  </div>
                ))}
              </div>
              <p className="credits">
                Exercise images from <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noreferrer">Free Exercise DB</a>.
              </p>
            </section>
          )}
    </>
  )
}
