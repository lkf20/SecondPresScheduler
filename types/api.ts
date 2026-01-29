/**
 * TypeScript interfaces for API responses and component props
 */

export interface TimeSlot {
  id: string
  code: string
  name: string | null
  default_start_time: string | null
  default_end_time: string | null
  display_order: number | null
  created_at?: string
}

export interface ClassGroup {
  id: string
  name: string
  parent_class_id: string | null
  min_age: number | null
  max_age: number | null
  required_ratio: number
  preferred_ratio: number | null
  order: number | null
  created_at?: string
  updated_at?: string
}

export interface Classroom {
  id: string
  name: string
  capacity: number | null
  color: string | null
  order: number | null
  created_at?: string
  updated_at?: string
}

export interface ClassroomWithAllowedClasses extends Classroom {
  allowed_classes?: Array<{
    id: string
    class_group_id?: string
    class_group?: {
      id: string
      name: string
    } | null
  }>
  // Note: allowed_classes.class_group references class_groups table
}

export interface TeacherSchedule {
  id: string
  teacher_id: string
  day_of_week_id: string
  time_slot_id: string
  classroom_id: string
  is_floater: boolean
  teacher?: {
    id: string
    first_name: string
    last_name: string
    display_name: string | null
  }
  classroom?: {
    id: string
    name: string
  }
  day_of_week?: {
    id: string
    name: string
    day_number: number
  }
  time_slot?: {
    id: string
    code: string
    name: string | null
  }
  created_at?: string | null
  updated_at?: string | null
}
