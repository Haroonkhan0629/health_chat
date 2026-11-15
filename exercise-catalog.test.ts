import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { exercises, workoutSchema } from './src/exercises'

describe('exercise catalog', () => {
  it('maps every exercise to an existing local JPEG', () => {
    const entries = Object.entries(exercises)
    expect(entries.length).toBeGreaterThan(16)
    for (const [id, exercise] of entries) {
      expect(exercise.name).toBeTruthy()
      expect(exercise.group).toBeTruthy()
      expect(exercise.image).toBe(`/images/exercises/${id}.jpg`)
      const image = readFileSync(new URL(`./public${exercise.image}`, import.meta.url))
      expect(image.subarray(0, 3).toString('hex')).toBe('ffd8ff')
    }
  })

  it('rejects unknown exercise IDs', () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map((day, i) => ({
        day, title: 'Workout', note: 'Take your time.',
        exercises: i === 0 ? [{ id: 'not-an-exercise', sets: '3', reps: '8-12' }] : [],
      }))
    expect(workoutSchema.safeParse({ valid: true, days }).success).toBe(false)
  })

  it('accepts rest days and up to five exercises but rejects six', () => {
    const exercise = { id: 'barbell-bench-press', sets: '3', reps: '8-12' }
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map((day, i) => ({
        day, title: i === 0 ? 'Chest' : 'Rest', note: 'Take your time.',
        exercises: i === 0 ? Array.from({ length: 5 }, () => exercise) : [],
      }))
    expect(workoutSchema.safeParse({ valid: true, days }).success).toBe(true)
    days[0].exercises.push(exercise)
    expect(workoutSchema.safeParse({ valid: true, days }).success).toBe(false)
  })
})
