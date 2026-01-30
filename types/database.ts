export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1'
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          school_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          school_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_log_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
        ]
      }
      class_classroom_mappings: {
        Row: {
          class_group_id: string | null
          classroom_id: string
          created_at: string | null
          day_of_week_id: string
          id: string
          time_slot_id: string
          updated_at: string | null
        }
        Insert: {
          class_group_id?: string | null
          classroom_id: string
          created_at?: string | null
          day_of_week_id: string
          id?: string
          time_slot_id: string
          updated_at?: string | null
        }
        Update: {
          class_group_id?: string | null
          classroom_id?: string
          created_at?: string | null
          day_of_week_id?: string
          id?: string
          time_slot_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'class_classroom_mappings_class_group_id_fkey'
            columns: ['class_group_id']
            isOneToOne: false
            referencedRelation: 'class_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'class_classroom_mappings_classroom_id_fkey'
            columns: ['classroom_id']
            isOneToOne: false
            referencedRelation: 'classrooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'class_classroom_mappings_day_of_week_id_fkey'
            columns: ['day_of_week_id']
            isOneToOne: false
            referencedRelation: 'days_of_week'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'class_classroom_mappings_time_slot_id_fkey'
            columns: ['time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          },
        ]
      }
      class_groups: {
        Row: {
          created_at: string | null
          diaper_changing_required: boolean | null
          id: string
          is_active: boolean
          lifting_children_required: boolean | null
          max_age: number | null
          min_age: number | null
          name: string
          order: number | null
          parent_class_id: string | null
          preferred_ratio: number | null
          required_ratio: number
          school_id: string
          toileting_assistance_required: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          diaper_changing_required?: boolean | null
          id?: string
          is_active?: boolean
          lifting_children_required?: boolean | null
          max_age?: number | null
          min_age?: number | null
          name: string
          order?: number | null
          parent_class_id?: string | null
          preferred_ratio?: number | null
          required_ratio?: number
          school_id: string
          toileting_assistance_required?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          diaper_changing_required?: boolean | null
          id?: string
          is_active?: boolean
          lifting_children_required?: boolean | null
          max_age?: number | null
          min_age?: number | null
          name?: string
          order?: number | null
          parent_class_id?: string | null
          preferred_ratio?: number | null
          required_ratio?: number
          school_id?: string
          toileting_assistance_required?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'class_groups_parent_class_id_fkey'
            columns: ['parent_class_id']
            isOneToOne: false
            referencedRelation: 'class_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'class_groups_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
        ]
      }
      classroom_allowed_classes: {
        Row: {
          class_group_id: string | null
          classroom_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          class_group_id?: string | null
          classroom_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          class_group_id?: string | null
          classroom_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'classroom_allowed_classes_class_group_id_fkey'
            columns: ['class_group_id']
            isOneToOne: false
            referencedRelation: 'class_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'classroom_allowed_classes_classroom_id_fkey'
            columns: ['classroom_id']
            isOneToOne: false
            referencedRelation: 'classrooms'
            referencedColumns: ['id']
          },
        ]
      }
      classroom_preferences: {
        Row: {
          can_teach: boolean | null
          classroom_id: string
          created_at: string | null
          id: string
          staff_id: string
          updated_at: string | null
        }
        Insert: {
          can_teach?: boolean | null
          classroom_id: string
          created_at?: string | null
          id?: string
          staff_id: string
          updated_at?: string | null
        }
        Update: {
          can_teach?: boolean | null
          classroom_id?: string
          created_at?: string | null
          id?: string
          staff_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'classroom_preferences_classroom_id_fkey'
            columns: ['classroom_id']
            isOneToOne: false
            referencedRelation: 'classrooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'classroom_preferences_staff_id_fkey'
            columns: ['staff_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
        ]
      }
      classrooms: {
        Row: {
          capacity: number | null
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          order: number | null
          school_id: string
          updated_at: string | null
        }
        Insert: {
          capacity?: number | null
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          order?: number | null
          school_id: string
          updated_at?: string | null
        }
        Update: {
          capacity?: number | null
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          order?: number | null
          school_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'classrooms_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
        ]
      }
      coverage_request_shifts: {
        Row: {
          class_group_id: string | null
          classroom_id: string
          coverage_request_id: string
          created_at: string | null
          date: string
          day_of_week_id: string | null
          end_time: string | null
          id: string
          is_partial: boolean | null
          school_id: string
          start_time: string | null
          status: Database['public']['Enums']['coverage_request_shift_status']
          time_slot_id: string
        }
        Insert: {
          class_group_id?: string | null
          classroom_id: string
          coverage_request_id: string
          created_at?: string | null
          date: string
          day_of_week_id?: string | null
          end_time?: string | null
          id?: string
          is_partial?: boolean | null
          school_id: string
          start_time?: string | null
          status?: Database['public']['Enums']['coverage_request_shift_status']
          time_slot_id: string
        }
        Update: {
          class_group_id?: string | null
          classroom_id?: string
          coverage_request_id?: string
          created_at?: string | null
          date?: string
          day_of_week_id?: string | null
          end_time?: string | null
          id?: string
          is_partial?: boolean | null
          school_id?: string
          start_time?: string | null
          status?: Database['public']['Enums']['coverage_request_shift_status']
          time_slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'coverage_request_shifts_class_group_id_fkey'
            columns: ['class_group_id']
            isOneToOne: false
            referencedRelation: 'class_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'coverage_request_shifts_classroom_id_fkey'
            columns: ['classroom_id']
            isOneToOne: false
            referencedRelation: 'classrooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'coverage_request_shifts_coverage_request_id_fkey'
            columns: ['coverage_request_id']
            isOneToOne: false
            referencedRelation: 'coverage_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'coverage_request_shifts_day_of_week_id_fkey'
            columns: ['day_of_week_id']
            isOneToOne: false
            referencedRelation: 'days_of_week'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'coverage_request_shifts_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'coverage_request_shifts_time_slot_id_fkey'
            columns: ['time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          },
        ]
      }
      coverage_requests: {
        Row: {
          covered_shifts: number
          created_at: string | null
          end_date: string
          id: string
          request_type: Database['public']['Enums']['coverage_request_type']
          school_id: string
          source_request_id: string | null
          start_date: string
          status: Database['public']['Enums']['coverage_request_status']
          teacher_id: string
          total_shifts: number
          updated_at: string | null
        }
        Insert: {
          covered_shifts?: number
          created_at?: string | null
          end_date: string
          id?: string
          request_type?: Database['public']['Enums']['coverage_request_type']
          school_id: string
          source_request_id?: string | null
          start_date: string
          status?: Database['public']['Enums']['coverage_request_status']
          teacher_id: string
          total_shifts?: number
          updated_at?: string | null
        }
        Update: {
          covered_shifts?: number
          created_at?: string | null
          end_date?: string
          id?: string
          request_type?: Database['public']['Enums']['coverage_request_type']
          school_id?: string
          source_request_id?: string | null
          start_date?: string
          status?: Database['public']['Enums']['coverage_request_status']
          teacher_id?: string
          total_shifts?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'coverage_requests_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'coverage_requests_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
        ]
      }
      days_of_week: {
        Row: {
          created_at: string | null
          day_number: number
          display_order: number | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          day_number: number
          display_order?: number | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          day_number?: number
          display_order?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          class_group_id: string | null
          created_at: string | null
          day_of_week_id: string
          enrollment_count: number
          id: string
          time_slot_id: string
          updated_at: string | null
        }
        Insert: {
          class_group_id?: string | null
          created_at?: string | null
          day_of_week_id: string
          enrollment_count?: number
          id?: string
          time_slot_id: string
          updated_at?: string | null
        }
        Update: {
          class_group_id?: string | null
          created_at?: string | null
          day_of_week_id?: string
          enrollment_count?: number
          id?: string
          time_slot_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'enrollments_class_group_id_fkey'
            columns: ['class_group_id']
            isOneToOne: false
            referencedRelation: 'class_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enrollments_day_of_week_id_fkey'
            columns: ['day_of_week_id']
            isOneToOne: false
            referencedRelation: 'days_of_week'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enrollments_time_slot_id_fkey'
            columns: ['time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          first_name: string | null
          last_name: string | null
          role: Database['public']['Enums']['profile_role']
          school_id: string
          theme: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          first_name?: string | null
          last_name?: string | null
          role?: Database['public']['Enums']['profile_role']
          school_id: string
          theme?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          first_name?: string | null
          last_name?: string | null
          role?: Database['public']['Enums']['profile_role']
          school_id?: string
          theme?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
        ]
      }
      qualification_definitions: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          school_id: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          school_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          school_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      schedule_cell_class_groups: {
        Row: {
          class_group_id: string
          created_at: string | null
          id: string
          schedule_cell_id: string
        }
        Insert: {
          class_group_id: string
          created_at?: string | null
          id?: string
          schedule_cell_id: string
        }
        Update: {
          class_group_id?: string
          created_at?: string | null
          id?: string
          schedule_cell_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'schedule_cell_class_groups_class_group_id_fkey'
            columns: ['class_group_id']
            isOneToOne: false
            referencedRelation: 'class_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'schedule_cell_class_groups_schedule_cell_id_fkey'
            columns: ['schedule_cell_id']
            isOneToOne: false
            referencedRelation: 'schedule_cells'
            referencedColumns: ['id']
          },
        ]
      }
      schedule_cells: {
        Row: {
          classroom_id: string
          created_at: string | null
          day_of_week_id: string
          enrollment_for_staffing: number | null
          id: string
          is_active: boolean
          notes: string | null
          school_id: string
          time_slot_id: string
          updated_at: string | null
        }
        Insert: {
          classroom_id: string
          created_at?: string | null
          day_of_week_id: string
          enrollment_for_staffing?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          school_id: string
          time_slot_id: string
          updated_at?: string | null
        }
        Update: {
          classroom_id?: string
          created_at?: string | null
          day_of_week_id?: string
          enrollment_for_staffing?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          school_id?: string
          time_slot_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'schedule_cells_classroom_id_fkey'
            columns: ['classroom_id']
            isOneToOne: false
            referencedRelation: 'classrooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'schedule_cells_day_of_week_id_fkey'
            columns: ['day_of_week_id']
            isOneToOne: false
            referencedRelation: 'days_of_week'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'schedule_cells_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'schedule_cells_time_slot_id_fkey'
            columns: ['time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          },
        ]
      }
      schedule_settings: {
        Row: {
          created_at: string | null
          id: string
          school_id: string
          selected_day_ids: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          school_id: string
          selected_day_ids?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          school_id?: string
          selected_day_ids?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'schedule_settings_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
        ]
      }
      schools: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          active: boolean | null
          can_assist_with_toileting: boolean | null
          can_change_diapers: boolean | null
          can_lift_children: boolean | null
          capabilities_notes: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          first_name: string
          id: string
          is_sub: boolean | null
          is_teacher: boolean | null
          last_name: string
          phone: string | null
          role_type_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          can_assist_with_toileting?: boolean | null
          can_change_diapers?: boolean | null
          can_lift_children?: boolean | null
          capabilities_notes?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_sub?: boolean | null
          is_teacher?: boolean | null
          last_name: string
          phone?: string | null
          role_type_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          can_assist_with_toileting?: boolean | null
          can_change_diapers?: boolean | null
          can_lift_children?: boolean | null
          capabilities_notes?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_sub?: boolean | null
          is_teacher?: boolean | null
          last_name?: string
          phone?: string | null
          role_type_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'staff_role_type_id_fkey'
            columns: ['role_type_id']
            isOneToOne: false
            referencedRelation: 'staff_role_types'
            referencedColumns: ['id']
          },
        ]
      }
      staff_qualifications: {
        Row: {
          created_at: string | null
          expires_on: string | null
          id: string
          level: string | null
          notes: string | null
          qualification_id: string
          staff_id: string
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          expires_on?: string | null
          id?: string
          level?: string | null
          notes?: string | null
          qualification_id: string
          staff_id: string
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          expires_on?: string | null
          id?: string
          level?: string | null
          notes?: string | null
          qualification_id?: string
          staff_id?: string
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: 'staff_qualifications_qualification_id_fkey'
            columns: ['qualification_id']
            isOneToOne: false
            referencedRelation: 'qualification_definitions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'staff_qualifications_staff_id_fkey'
            columns: ['staff_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
        ]
      }
      staff_role_types: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          id: string
          is_system: boolean | null
          label: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          label: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          label?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      staffing_rules: {
        Row: {
          classroom_id: string
          created_at: string | null
          day_of_week_id: string
          id: string
          preferred_teachers: number
          required_teachers: number
          school_id: string
          time_slot_id: string
          updated_at: string | null
        }
        Insert: {
          classroom_id: string
          created_at?: string | null
          day_of_week_id: string
          id?: string
          preferred_teachers: number
          required_teachers: number
          school_id: string
          time_slot_id: string
          updated_at?: string | null
        }
        Update: {
          classroom_id?: string
          created_at?: string | null
          day_of_week_id?: string
          id?: string
          preferred_teachers?: number
          required_teachers?: number
          school_id?: string
          time_slot_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'staffing_rules_classroom_id_fkey'
            columns: ['classroom_id']
            isOneToOne: false
            referencedRelation: 'classrooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'staffing_rules_day_of_week_id_fkey'
            columns: ['day_of_week_id']
            isOneToOne: false
            referencedRelation: 'days_of_week'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'staffing_rules_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'staffing_rules_time_slot_id_fkey'
            columns: ['time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          },
        ]
      }
      sub_assignments: {
        Row: {
          assignment_kind: Database['public']['Enums']['assignment_kind']
          assignment_type: string
          classroom_id: string
          coverage_request_shift_id: string
          created_at: string | null
          date: string
          day_of_week_id: string
          id: string
          is_partial: boolean | null
          notes: string | null
          partial_end_time: string | null
          partial_start_time: string | null
          status: Database['public']['Enums']['sub_assignment_status']
          sub_id: string
          teacher_id: string
          time_slot_id: string
          updated_at: string | null
        }
        Insert: {
          assignment_kind?: Database['public']['Enums']['assignment_kind']
          assignment_type: string
          classroom_id: string
          coverage_request_shift_id: string
          created_at?: string | null
          date: string
          day_of_week_id: string
          id?: string
          is_partial?: boolean | null
          notes?: string | null
          partial_end_time?: string | null
          partial_start_time?: string | null
          status?: Database['public']['Enums']['sub_assignment_status']
          sub_id: string
          teacher_id: string
          time_slot_id: string
          updated_at?: string | null
        }
        Update: {
          assignment_kind?: Database['public']['Enums']['assignment_kind']
          assignment_type?: string
          classroom_id?: string
          coverage_request_shift_id?: string
          created_at?: string | null
          date?: string
          day_of_week_id?: string
          id?: string
          is_partial?: boolean | null
          notes?: string | null
          partial_end_time?: string | null
          partial_start_time?: string | null
          status?: Database['public']['Enums']['sub_assignment_status']
          sub_id?: string
          teacher_id?: string
          time_slot_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sub_assignments_classroom_id_fkey'
            columns: ['classroom_id']
            isOneToOne: false
            referencedRelation: 'classrooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sub_assignments_coverage_request_shift_id_fkey'
            columns: ['coverage_request_shift_id']
            isOneToOne: false
            referencedRelation: 'coverage_request_shifts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sub_assignments_day_of_week_id_fkey'
            columns: ['day_of_week_id']
            isOneToOne: false
            referencedRelation: 'days_of_week'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sub_assignments_sub_id_fkey'
            columns: ['sub_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sub_assignments_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sub_assignments_time_slot_id_fkey'
            columns: ['time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          },
        ]
      }
      sub_availability: {
        Row: {
          available: boolean | null
          created_at: string | null
          day_of_week_id: string
          id: string
          sub_id: string
          time_slot_id: string
          updated_at: string | null
        }
        Insert: {
          available?: boolean | null
          created_at?: string | null
          day_of_week_id: string
          id?: string
          sub_id: string
          time_slot_id: string
          updated_at?: string | null
        }
        Update: {
          available?: boolean | null
          created_at?: string | null
          day_of_week_id?: string
          id?: string
          sub_id?: string
          time_slot_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sub_availability_day_of_week_id_fkey'
            columns: ['day_of_week_id']
            isOneToOne: false
            referencedRelation: 'days_of_week'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sub_availability_sub_id_fkey'
            columns: ['sub_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sub_availability_time_slot_id_fkey'
            columns: ['time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          },
        ]
      }
      sub_availability_exception_headers: {
        Row: {
          available: boolean
          created_at: string | null
          end_date: string
          id: string
          start_date: string
          sub_id: string
          updated_at: string | null
        }
        Insert: {
          available: boolean
          created_at?: string | null
          end_date: string
          id?: string
          start_date: string
          sub_id: string
          updated_at?: string | null
        }
        Update: {
          available?: boolean
          created_at?: string | null
          end_date?: string
          id?: string
          start_date?: string
          sub_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sub_availability_exception_headers_sub_id_fkey'
            columns: ['sub_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
        ]
      }
      sub_availability_exceptions: {
        Row: {
          available: boolean | null
          created_at: string | null
          date: string
          exception_header_id: string | null
          id: string
          sub_id: string
          time_slot_id: string
        }
        Insert: {
          available?: boolean | null
          created_at?: string | null
          date: string
          exception_header_id?: string | null
          id?: string
          sub_id: string
          time_slot_id: string
        }
        Update: {
          available?: boolean | null
          created_at?: string | null
          date?: string
          exception_header_id?: string | null
          id?: string
          sub_id?: string
          time_slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sub_availability_exceptions_exception_header_id_fkey'
            columns: ['exception_header_id']
            isOneToOne: false
            referencedRelation: 'sub_availability_exception_headers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sub_availability_exceptions_sub_id_fkey'
            columns: ['sub_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sub_availability_exceptions_time_slot_id_fkey'
            columns: ['time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          },
        ]
      }
      sub_class_preferences: {
        Row: {
          can_teach: boolean | null
          created_at: string | null
          id: string
          sub_id: string
          updated_at: string | null
        }
        Insert: {
          can_teach?: boolean | null
          created_at?: string | null
          id?: string
          sub_id: string
          updated_at?: string | null
        }
        Update: {
          can_teach?: boolean | null
          created_at?: string | null
          id?: string
          sub_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sub_class_preferences_sub_id_fkey'
            columns: ['sub_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
        ]
      }
      sub_contact_log: {
        Row: {
          contact_date: string
          contact_status: Database['public']['Enums']['sub_contact_status']
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          sub_id: string
          teacher_id: string
        }
        Insert: {
          contact_date: string
          contact_status: Database['public']['Enums']['sub_contact_status']
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          sub_id: string
          teacher_id: string
        }
        Update: {
          contact_date?: string
          contact_status?: Database['public']['Enums']['sub_contact_status']
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          sub_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sub_contact_log_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sub_contact_log_sub_id_fkey'
            columns: ['sub_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sub_contact_log_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
        ]
      }
      sub_contact_overrides: {
        Row: {
          contact_status: string | null
          created_at: string | null
          end_time: string | null
          id: string
          is_partial: boolean | null
          notes: string | null
          shift_id: string
          start_time: string | null
          sub_id: string
          teacher_id: string
          updated_at: string | null
          will_work: boolean | null
        }
        Insert: {
          contact_status?: string | null
          created_at?: string | null
          end_time?: string | null
          id?: string
          is_partial?: boolean | null
          notes?: string | null
          shift_id: string
          start_time?: string | null
          sub_id: string
          teacher_id: string
          updated_at?: string | null
          will_work?: boolean | null
        }
        Update: {
          contact_status?: string | null
          created_at?: string | null
          end_time?: string | null
          id?: string
          is_partial?: boolean | null
          notes?: string | null
          shift_id?: string
          start_time?: string | null
          sub_id?: string
          teacher_id?: string
          updated_at?: string | null
          will_work?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: 'sub_contact_overrides_sub_id_fkey'
            columns: ['sub_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sub_contact_overrides_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
        ]
      }
      sub_contact_shift_overrides: {
        Row: {
          coverage_request_shift_id: string
          created_at: string
          id: string
          is_partial: boolean
          notes: string | null
          override_availability: boolean
          partial_end_time: string | null
          partial_start_time: string | null
          selected: boolean
          substitute_contact_id: string
          updated_at: string
        }
        Insert: {
          coverage_request_shift_id: string
          created_at?: string
          id?: string
          is_partial?: boolean
          notes?: string | null
          override_availability?: boolean
          partial_end_time?: string | null
          partial_start_time?: string | null
          selected?: boolean
          substitute_contact_id: string
          updated_at?: string
        }
        Update: {
          coverage_request_shift_id?: string
          created_at?: string
          id?: string
          is_partial?: boolean
          notes?: string | null
          override_availability?: boolean
          partial_end_time?: string | null
          partial_start_time?: string | null
          selected?: boolean
          substitute_contact_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sub_contact_shift_overrides_coverage_request_shift_id_fkey'
            columns: ['coverage_request_shift_id']
            isOneToOne: false
            referencedRelation: 'coverage_request_shifts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sub_contact_shift_overrides_substitute_contact_id_fkey'
            columns: ['substitute_contact_id']
            isOneToOne: false
            referencedRelation: 'substitute_contacts'
            referencedColumns: ['id']
          },
        ]
      }
      substitute_contacts: {
        Row: {
          assigned_at: string | null
          contacted_at: string | null
          coverage_request_id: string
          created_at: string
          created_by: string | null
          declined_at: string | null
          id: string
          is_contacted: boolean
          last_status_at: string
          notes: string | null
          response_status: string
          status: string
          sub_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_at?: string | null
          contacted_at?: string | null
          coverage_request_id: string
          created_at?: string
          created_by?: string | null
          declined_at?: string | null
          id?: string
          is_contacted?: boolean
          last_status_at?: string
          notes?: string | null
          response_status?: string
          status?: string
          sub_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_at?: string | null
          contacted_at?: string | null
          coverage_request_id?: string
          created_at?: string
          created_by?: string | null
          declined_at?: string | null
          id?: string
          is_contacted?: boolean
          last_status_at?: string
          notes?: string | null
          response_status?: string
          status?: string
          sub_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'substitute_contacts_coverage_request_id_fkey'
            columns: ['coverage_request_id']
            isOneToOne: false
            referencedRelation: 'coverage_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'substitute_contacts_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'substitute_contacts_sub_id_fkey'
            columns: ['sub_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'substitute_contacts_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
        ]
      }
      teacher_schedule_audit_log: {
        Row: {
          action: string
          action_details: Json | null
          added_to_classroom_id: string | null
          added_to_day_id: string | null
          added_to_time_slot_id: string | null
          created_at: string | null
          id: string
          reason: string | null
          removed_from_classroom_id: string | null
          removed_from_day_id: string | null
          removed_from_time_slot_id: string | null
          teacher_id: string
          teacher_schedule_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          action_details?: Json | null
          added_to_classroom_id?: string | null
          added_to_day_id?: string | null
          added_to_time_slot_id?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          removed_from_classroom_id?: string | null
          removed_from_day_id?: string | null
          removed_from_time_slot_id?: string | null
          teacher_id: string
          teacher_schedule_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          action_details?: Json | null
          added_to_classroom_id?: string | null
          added_to_day_id?: string | null
          added_to_time_slot_id?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          removed_from_classroom_id?: string | null
          removed_from_day_id?: string | null
          removed_from_time_slot_id?: string | null
          teacher_id?: string
          teacher_schedule_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'teacher_schedule_audit_log_added_to_classroom_id_fkey'
            columns: ['added_to_classroom_id']
            isOneToOne: false
            referencedRelation: 'classrooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_schedule_audit_log_added_to_day_id_fkey'
            columns: ['added_to_day_id']
            isOneToOne: false
            referencedRelation: 'days_of_week'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_schedule_audit_log_added_to_time_slot_id_fkey'
            columns: ['added_to_time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_schedule_audit_log_removed_from_classroom_id_fkey'
            columns: ['removed_from_classroom_id']
            isOneToOne: false
            referencedRelation: 'classrooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_schedule_audit_log_removed_from_day_id_fkey'
            columns: ['removed_from_day_id']
            isOneToOne: false
            referencedRelation: 'days_of_week'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_schedule_audit_log_removed_from_time_slot_id_fkey'
            columns: ['removed_from_time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_schedule_audit_log_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_schedule_audit_log_teacher_schedule_id_fkey'
            columns: ['teacher_schedule_id']
            isOneToOne: false
            referencedRelation: 'teacher_schedules'
            referencedColumns: ['id']
          },
        ]
      }
      teacher_schedules: {
        Row: {
          classroom_id: string
          created_at: string | null
          day_of_week_id: string
          id: string
          is_floater: boolean
          school_id: string
          teacher_id: string
          time_slot_id: string
          updated_at: string | null
        }
        Insert: {
          classroom_id: string
          created_at?: string | null
          day_of_week_id: string
          id?: string
          is_floater?: boolean
          school_id: string
          teacher_id: string
          time_slot_id: string
          updated_at?: string | null
        }
        Update: {
          classroom_id?: string
          created_at?: string | null
          day_of_week_id?: string
          id?: string
          is_floater?: boolean
          school_id?: string
          teacher_id?: string
          time_slot_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'teacher_schedules_classroom_id_fkey'
            columns: ['classroom_id']
            isOneToOne: false
            referencedRelation: 'classrooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_schedules_day_of_week_id_fkey'
            columns: ['day_of_week_id']
            isOneToOne: false
            referencedRelation: 'days_of_week'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_schedules_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_schedules_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_schedules_time_slot_id_fkey'
            columns: ['time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          },
        ]
      }
      time_off_requests: {
        Row: {
          coverage_request_id: string | null
          created_at: string | null
          end_date: string
          id: string
          notes: string | null
          reason: string | null
          shift_selection_mode: Database['public']['Enums']['time_off_shift_selection_mode'] | null
          start_date: string
          status: Database['public']['Enums']['time_off_request_status']
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          coverage_request_id?: string | null
          created_at?: string | null
          end_date: string
          id?: string
          notes?: string | null
          reason?: string | null
          shift_selection_mode?: Database['public']['Enums']['time_off_shift_selection_mode'] | null
          start_date: string
          status?: Database['public']['Enums']['time_off_request_status']
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          coverage_request_id?: string | null
          created_at?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          reason?: string | null
          shift_selection_mode?: Database['public']['Enums']['time_off_shift_selection_mode'] | null
          start_date?: string
          status?: Database['public']['Enums']['time_off_request_status']
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'time_off_requests_coverage_request_id_fkey'
            columns: ['coverage_request_id']
            isOneToOne: false
            referencedRelation: 'coverage_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'time_off_requests_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
        ]
      }
      time_off_shifts: {
        Row: {
          created_at: string | null
          date: string
          day_of_week_id: string | null
          end_time: string | null
          id: string
          is_partial: boolean | null
          start_time: string | null
          time_off_request_id: string
          time_slot_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          day_of_week_id?: string | null
          end_time?: string | null
          id?: string
          is_partial?: boolean | null
          start_time?: string | null
          time_off_request_id: string
          time_slot_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          day_of_week_id?: string | null
          end_time?: string | null
          id?: string
          is_partial?: boolean | null
          start_time?: string | null
          time_off_request_id?: string
          time_slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'time_off_shifts_day_of_week_id_fkey'
            columns: ['day_of_week_id']
            isOneToOne: false
            referencedRelation: 'days_of_week'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'time_off_shifts_time_off_request_id_fkey'
            columns: ['time_off_request_id']
            isOneToOne: false
            referencedRelation: 'time_off_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'time_off_shifts_time_slot_id_fkey'
            columns: ['time_slot_id']
            isOneToOne: false
            referencedRelation: 'time_slots'
            referencedColumns: ['id']
          },
        ]
      }
      time_slots: {
        Row: {
          code: string
          created_at: string | null
          default_end_time: string | null
          default_start_time: string | null
          display_order: number | null
          id: string
          name: string | null
          school_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          default_end_time?: string | null
          default_start_time?: string | null
          display_order?: number | null
          id?: string
          name?: string | null
          school_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          default_end_time?: string | null
          default_start_time?: string | null
          display_order?: number | null
          id?: string
          name?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'time_slots_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_belongs_to_school: {
        Args: { check_school_id: string }
        Returns: boolean
      }
    }
    Enums: {
      assignment_kind: 'absence_coverage' | 'extra_coverage'
      coverage_request_shift_status: 'active' | 'cancelled'
      coverage_request_status: 'open' | 'filled' | 'cancelled'
      coverage_request_type: 'time_off' | 'extra_coverage'
      profile_role: 'admin' | 'director' | 'teacher' | 'viewer'
      sub_assignment_status: 'active' | 'cancelled'
      sub_contact_status: 'no_response' | 'pending' | 'confirmed' | 'declined'
      time_off_request_status: 'draft' | 'active' | 'cancelled'
      time_off_shift_selection_mode: 'select_shifts' | 'all_scheduled'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      assignment_kind: ['absence_coverage', 'extra_coverage'],
      coverage_request_shift_status: ['active', 'cancelled'],
      coverage_request_status: ['open', 'filled', 'cancelled'],
      coverage_request_type: ['time_off', 'extra_coverage'],
      profile_role: ['admin', 'director', 'teacher', 'viewer'],
      sub_assignment_status: ['active', 'cancelled'],
      sub_contact_status: ['no_response', 'pending', 'confirmed', 'declined'],
      time_off_request_status: ['draft', 'active', 'cancelled'],
      time_off_shift_selection_mode: ['select_shifts', 'all_scheduled'],
    },
  },
} as const
