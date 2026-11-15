import { z } from 'zod'
import catalog from './exercise-catalog.json'

export const exercises = catalog

type ExerciseId = keyof typeof exercises
const exerciseIds = Object.keys(exercises) as [ExerciseId, ...ExerciseId[]]
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const workoutSchema = z.object({
  valid: z.literal(true),
  days: z.array(z.object({
    day: z.string(),
    title: z.string().min(1).max(100),
    note: z.string().min(1).max(300),
    exercises: z.array(z.object({
      id: z.enum(exerciseIds),
      sets: z.string().min(1).max(30),
      reps: z.string().min(1).max(30),
    })).max(5),
  })).length(7).refine((value) => value.every((day, i) => day.day === days[i])),
})

export type Workout = z.infer<typeof workoutSchema>
