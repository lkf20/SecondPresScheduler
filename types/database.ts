/**
 * TypeScript types matching the database schema
 * These types correspond to the PostgreSQL tables in Supabase
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      classrooms: {
        Row: {
          id: string
          name: string
          capacity: number | null
          color: string | null
          order: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          capacity?: number | null
          color?: string | null
          order?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          capacity?: number | null
          color?: string | null
          order?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      class_groups: {
        Row: {
          id: string
          name: string
          parent_class_id: string | null
          min_age: number | null
          max_age: number | null
          required_ratio: number
          preferred_ratio: number | null
          diaper_changing_required: boolean | null
          lifting_children_required: boolean | null
          toileting_assistance_required: boolean | null
          order: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          parent_class_id?: string | null
          min_age?: number | null
          max_age?: number | null
          required_ratio?: number
          preferred_ratio?: number | null
          diaper_changing_required?: boolean | null
          lifting_children_required?: boolean | null
          toileting_assistance_required?: boolean | null
          order?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          parent_class_id?: string | null
          min_age?: number | null
          max_age?: number | null
          required_ratio?: number
          preferred_ratio?: number | null
          diaper_changing_required?: boolean | null
          lifting_children_required?: boolean | null
          toileting_assistance_required?: boolean | null
          order?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      schedule_cell_class_groups: {
        Row: {
          id: string
          schedule_cell_id: string
          class_group_id: string
          created_at: string
        }
        Insert: {
          id?: string
          schedule_cell_id: string
          class_group_id: string
          created_at?: string
        }
        Update: {
          id?: string
          schedule_cell_id?: string
          class_group_id?: string
          created_at?: string
        }
      }
      time_slots: {
        Row: {
          id: string
          code: string
          name: string | null
          default_start_time: string | null
          default_end_time: string | null
          display_order: number | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name?: string | null
          default_start_time?: string | null
          default_end_time?: string | null
          display_order?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string | null
          default_start_time?: string | null
          default_end_time?: string | null
          display_order?: number | null
          created_at?: string
        }
      }
      days_of_week: {
        Row: {
          id: string
          name: string
          day_number: number
          display_order: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          day_number: number
          display_order?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          day_number?: number
          display_order?: number | null
          created_at?: string
        }
      }
      staff_role_types: {
        Row: {
          id: string
          code: string
          label: string
          is_system: boolean
          sort_order: number | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          label: string
          is_system?: boolean
          sort_order?: number | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          label?: string
          is_system?: boolean
          sort_order?: number | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      staff: {
        Row: {
          id: string
          first_name: string
          last_name: string
          display_name: string | null
          phone: string | null
          email: string
          role_type_id: string | null
          is_teacher: boolean
          is_sub: boolean
          active: boolean
          can_change_diapers: boolean | null
          can_lift_children: boolean | null
          can_assist_with_toileting: boolean | null
          capabilities_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          first_name: string
          last_name: string
          display_name?: string | null
          phone?: string | null
          email: string
          role_type_id?: string | null
          is_teacher?: boolean
          is_sub?: boolean
          active?: boolean
          can_change_diapers?: boolean | null
          can_lift_children?: boolean | null
          can_assist_with_toileting?: boolean | null
          capabilities_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          display_name?: string | null
          phone?: string | null
          email?: string
          role_type_id?: string | null
          is_teacher?: boolean
          is_sub?: boolean
          active?: boolean
          can_change_diapers?: boolean | null
          can_lift_children?: boolean | null
          can_assist_with_toileting?: boolean | null
          capabilities_notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      teacher_schedules: {
        Row: {
          id: string
          teacher_id: string
          day_of_week_id: string
          time_slot_id: string
          class_id: string
          classroom_id: string
          is_floater: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          day_of_week_id: string
          time_slot_id: string
          class_id: string
          classroom_id: string
          is_floater?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          day_of_week_id?: string
          time_slot_id?: string
          class_id?: string
          classroom_id?: string
          is_floater?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      teacher_schedule_audit_log: {
        Row: {
          id: string
          teacher_schedule_id: string | null
          teacher_id: string
          action: string
          action_details: Json | null
          removed_from_classroom_id: string | null
          removed_from_day_id: string | null
          removed_from_time_slot_id: string | null
          added_to_classroom_id: string | null
          added_to_day_id: string | null
          added_to_time_slot_id: string | null
          reason: string | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          teacher_schedule_id?: string | null
          teacher_id: string
          action: string
          action_details?: Json | null
          removed_from_classroom_id?: string | null
          removed_from_day_id?: string | null
          removed_from_time_slot_id?: string | null
          added_to_classroom_id?: string | null
          added_to_day_id?: string | null
          added_to_time_slot_id?: string | null
          reason?: string | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          teacher_schedule_id?: string | null
          teacher_id?: string
          action?: string
          action_details?: Json | null
          removed_from_classroom_id?: string | null
          removed_from_day_id?: string | null
          removed_from_time_slot_id?: string | null
          added_to_classroom_id?: string | null
          added_to_day_id?: string | null
          added_to_time_slot_id?: string | null
          reason?: string | null
          user_id?: string | null
          created_at?: string
        }
      }
      sub_availability: {
        Row: {
          id: string
          sub_id: string
          day_of_week_id: string
          time_slot_id: string
          available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sub_id: string
          day_of_week_id: string
          time_slot_id: string
          available?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sub_id?: string
          day_of_week_id?: string
          time_slot_id?: string
          available?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      sub_availability_exceptions: {
        Row: {
          id: string
          sub_id: string
          date: string
          time_slot_id: string
          available: boolean
          exception_header_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sub_id: string
          date: string
          time_slot_id: string
          available?: boolean
          exception_header_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          sub_id?: string
          date?: string
          time_slot_id?: string
          available?: boolean
          exception_header_id?: string | null
          created_at?: string
        }
      }
      sub_availability_exception_headers: {
        Row: {
          id: string
          sub_id: string
          start_date: string
          end_date: string
          available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sub_id: string
          start_date: string
          end_date: string
          available: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sub_id?: string
          start_date?: string
          end_date?: string
          available?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      qualification_definitions: {
        Row: {
          id: string
          name: string
          category: string | null
          is_system: boolean
          school_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category?: string | null
          is_system?: boolean
          school_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string | null
          is_system?: boolean
          school_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      staff_qualifications: {
        Row: {
          id: string
          staff_id: string
          qualification_id: string
          level: string | null
          expires_on: string | null
          verified: boolean | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          qualification_id: string
          level?: string | null
          expires_on?: string | null
          verified?: boolean | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          qualification_id?: string
          level?: string | null
          expires_on?: string | null
          verified?: boolean | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sub_class_preferences: {
        Row: {
          id: string
          sub_id: string
          class_id: string
          can_teach: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sub_id: string
          class_id: string
          can_teach?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sub_id?: string
          class_id?: string
          can_teach?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      classroom_preferences: {
        Row: {
          id: string
          staff_id: string
          classroom_id: string
          can_teach: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          classroom_id: string
          can_teach?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          classroom_id?: string
          can_teach?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      class_classroom_mappings: {
        Row: {
          id: string
          class_id: string
          classroom_id: string
          day_of_week_id: string
          time_slot_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          class_id: string
          classroom_id: string
          day_of_week_id: string
          time_slot_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          classroom_id?: string
          day_of_week_id?: string
          time_slot_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      staffing_rules: {
        Row: {
          id: string
          class_id: string
          day_of_week_id: string
          time_slot_id: string
          preferred_teachers: number
          required_teachers: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          class_id: string
          day_of_week_id: string
          time_slot_id: string
          preferred_teachers: number
          required_teachers: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          day_of_week_id?: string
          time_slot_id?: string
          preferred_teachers?: number
          required_teachers?: number
          created_at?: string
          updated_at?: string
        }
      }
      enrollments: {
        Row: {
          id: string
          class_id: string
          day_of_week_id: string
          time_slot_id: string
          enrollment_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          class_id: string
          day_of_week_id: string
          time_slot_id: string
          enrollment_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          day_of_week_id?: string
          time_slot_id?: string
          enrollment_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      time_off_requests: {
        Row: {
          id: string
          teacher_id: string
          start_date: string
          end_date: string
          reason: string | null
          notes: string | null
          shift_selection_mode: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          start_date: string
          end_date: string
          reason?: string | null
          notes?: string | null
          shift_selection_mode?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          start_date?: string
          end_date?: string
          reason?: string | null
          notes?: string | null
          shift_selection_mode?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      time_off_shifts: {
        Row: {
          id: string
          time_off_request_id: string
          date: string
          day_of_week_id: string | null
          time_slot_id: string
          is_partial: boolean
          start_time: string | null
          end_time: string | null
          created_at: string
        }
        Insert: {
          id?: string
          time_off_request_id: string
          date: string
          day_of_week_id?: string | null
          time_slot_id: string
          is_partial?: boolean
          start_time?: string | null
          end_time?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          time_off_request_id?: string
          date?: string
          day_of_week_id?: string | null
          time_slot_id?: string
          is_partial?: boolean
          start_time?: string | null
          end_time?: string | null
          created_at?: string
        }
      }
      sub_assignments: {
        Row: {
          id: string
          sub_id: string
          teacher_id: string
          date: string
          day_of_week_id: string
          time_slot_id: string
          assignment_type: 'Substitute Shift' | 'Partial Sub Shift'
          classroom_id: string
          is_partial: boolean
          partial_start_time: string | null
          partial_end_time: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sub_id: string
          teacher_id: string
          date: string
          day_of_week_id: string
          time_slot_id: string
          assignment_type: 'Substitute Shift' | 'Partial Sub Shift'
          classroom_id: string
          is_partial?: boolean
          partial_start_time?: string | null
          partial_end_time?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sub_id?: string
          teacher_id?: string
          date?: string
          day_of_week_id?: string
          time_slot_id?: string
          assignment_type?: 'Substitute Shift' | 'Partial Sub Shift'
          classroom_id?: string
          is_partial?: boolean
          partial_start_time?: string | null
          partial_end_time?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sub_contact_overrides: {
        Row: {
          id: string
          sub_id: string
          teacher_id: string
          shift_id: string
          will_work: boolean
          is_partial: boolean
          start_time: string | null
          end_time: string | null
          contact_status: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sub_id: string
          teacher_id: string
          shift_id: string
          will_work?: boolean
          is_partial?: boolean
          start_time?: string | null
          end_time?: string | null
          contact_status?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sub_id?: string
          teacher_id?: string
          shift_id?: string
          will_work?: boolean
          is_partial?: boolean
          start_time?: string | null
          end_time?: string | null
          contact_status?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sub_contact_log: {
        Row: {
          id: string
          sub_id: string
          teacher_id: string
          contact_date: string
          contact_status: string
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sub_id: string
          teacher_id: string
          contact_date: string
          contact_status: string
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          sub_id?: string
          teacher_id?: string
          contact_date?: string
          contact_status?: string
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      schedule_cells: {
        Row: {
          id: string
          classroom_id: string
          day_of_week_id: string
          time_slot_id: string
          is_active: boolean
          enrollment_for_staffing: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          classroom_id: string
          day_of_week_id: string
          time_slot_id: string
          is_active?: boolean
          enrollment_for_staffing?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          classroom_id?: string
          day_of_week_id?: string
          time_slot_id?: string
          is_active?: boolean
          enrollment_for_staffing?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
