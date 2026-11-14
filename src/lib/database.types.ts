
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "categories": {
                  Row: {
                    "colour": string,"created_at": string,"created_by": string | null,"emoji": string,"family_id": string,"id": string,"name": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "colour"?: string,"created_at"?: string,"created_by"?: string | null,"emoji"?: string,"family_id": string,"id"?: string,"name": string,"sort"?: number
                  }
                  Update: {
                    "colour"?: string,"created_at"?: string,"created_by"?: string | null,"emoji"?: string,"family_id"?: string,"id"?: string,"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categories_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"event_attendees": {
                  Row: {
                    "added_at": string,"added_by": string | null,"event_id": string,"family_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"added_by"?: string | null,"event_id": string,"family_id": string,"user_id": string
                  }
                  Update: {
                    "added_at"?: string,"added_by"?: string | null,"event_id"?: string,"family_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_attendees_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_attendees_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_attendees_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_attendees_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_exceptions": {
                  Row: {
                    "event_id": string,"family_id": string,"skip_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"family_id": string,"skip_date": string
                  }
                  Update: {
                    "event_id"?: string,"family_id"?: string,"skip_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_exceptions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_exceptions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"event_types": {
                  Row: {
                    "colour": string,"created_at": string,"created_by": string | null,"emoji": string,"family_id": string,"id": string,"name": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "colour"?: string,"created_at"?: string,"created_by"?: string | null,"emoji"?: string,"family_id": string,"id"?: string,"name": string,"sort"?: number
                  }
                  Update: {
                    "colour"?: string,"created_at"?: string,"created_by"?: string | null,"emoji"?: string,"family_id"?: string,"id"?: string,"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_types_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_types_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "all_day": boolean,"colour": string | null,"created_at": string,"created_by": string | null,"end_date": string,"end_time": string | null,"family_id": string,"id": string,"location": string,"notes": string,"reminder_minutes": number | null,"repeat": string,"repeat_until": string | null,"start_date": string,"start_time": string | null,"title": string,"type_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "all_day"?: boolean,"colour"?: string | null,"created_at"?: string,"created_by"?: string | null,"end_date": string,"end_time"?: string | null,"family_id": string,"id"?: string,"location"?: string,"notes"?: string,"reminder_minutes"?: number | null,"repeat"?: string,"repeat_until"?: string | null,"start_date": string,"start_time"?: string | null,"title": string,"type_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "all_day"?: boolean,"colour"?: string | null,"created_at"?: string,"created_by"?: string | null,"end_date"?: string,"end_time"?: string | null,"family_id"?: string,"id"?: string,"location"?: string,"notes"?: string,"reminder_minutes"?: number | null,"repeat"?: string,"repeat_until"?: string | null,"start_date"?: string,"start_time"?: string | null,"title"?: string,"type_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_type_id_fkey"
      columns: ["type_id"]
isOneToOne: false
      referencedRelation: "event_types"
      referencedColumns: ["id"]
    }
                  ]
                },"families": {
                  Row: {
                    "created_at": string,"created_by": string | null,"encryption_enabled": boolean,"id": string,"members_can_add_events": boolean,"members_can_add_recipes": boolean,"members_can_add_shopping": boolean,"members_can_add_tasks": boolean,"name": string,"points_enabled": boolean,"timezone": string,"week_starts_on": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"encryption_enabled"?: boolean,"id"?: string,"members_can_add_events"?: boolean,"members_can_add_recipes"?: boolean,"members_can_add_shopping"?: boolean,"members_can_add_tasks"?: boolean,"name": string,"points_enabled"?: boolean,"timezone"?: string,"week_starts_on"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"encryption_enabled"?: boolean,"id"?: string,"members_can_add_events"?: boolean,"members_can_add_recipes"?: boolean,"members_can_add_shopping"?: boolean,"members_can_add_tasks"?: boolean,"name"?: string,"points_enabled"?: boolean,"timezone"?: string,"week_starts_on"?: number
                  }
                  Relationships: [
                    
                  ]
                },"family_invites": {
                  Row: {
                    "code": string,"created_at": string,"family_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"family_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"family_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_invites_family_id_fkey"
      columns: ["family_id"]
isOneToOne: true
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"family_members": {
                  Row: {
                    "colour": string,"family_id": string,"joined_at": string,"role": Database["public"]['Enums']["family_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "colour"?: string,"family_id": string,"joined_at"?: string,"role"?: Database["public"]['Enums']["family_role"],"user_id": string
                  }
                  Update: {
                    "colour"?: string,"family_id"?: string,"joined_at"?: string,"role"?: Database["public"]['Enums']["family_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_members_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "family_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"join_attempts": {
                  Row: {
                    "created_at": string,"id": number,"success": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"success": boolean,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"success"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"meal_plans": {
                  Row: {
                    "created_at": string,"created_by": string | null,"custom_title": string | null,"family_id": string,"id": string,"plan_date": string,"recipe_id": string | null,"slot": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"custom_title"?: string | null,"family_id": string,"id"?: string,"plan_date": string,"recipe_id"?: string | null,"slot": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"custom_title"?: string | null,"family_id"?: string,"id"?: string,"plan_date"?: string,"recipe_id"?: string | null,"slot"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_plans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_plans_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_plans_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_prefs": {
                  Row: {
                    "assignment_alerts": boolean,"daily_summary": boolean,"daily_summary_time": string,"event_reminders": boolean,"family_id": string,"new_recipe_alerts": boolean,"task_reminders": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_alerts"?: boolean,"daily_summary"?: boolean,"daily_summary_time"?: string,"event_reminders"?: boolean,"family_id": string,"new_recipe_alerts"?: boolean,"task_reminders"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "assignment_alerts"?: boolean,"daily_summary"?: boolean,"daily_summary_time"?: string,"event_reminders"?: boolean,"family_id"?: string,"new_recipe_alerts"?: boolean,"task_reminders"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_prefs_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_prefs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"body": string,"created_at": string,"dedupe_key": string | null,"family_id": string,"id": string,"kind": string,"link": string,"pushed_at": string | null,"read_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"body"?: string,"created_at"?: string,"dedupe_key"?: string | null,"family_id": string,"id"?: string,"kind": string,"link"?: string,"pushed_at"?: string | null,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"body"?: string,"created_at"?: string,"dedupe_key"?: string | null,"family_id"?: string,"id"?: string,"kind"?: string,"link"?: string,"pushed_at"?: string | null,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"emoji": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string,"emoji"?: string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"emoji"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"device_label": string,"endpoint": string,"id": string,"last_used_at": string | null,"p256dh": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"device_label"?: string,"endpoint": string,"id"?: string,"last_used_at"?: string | null,"p256dh": string,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"device_label"?: string,"endpoint"?: string,"id"?: string,"last_used_at"?: string | null,"p256dh"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_favourites": {
                  Row: {
                    "created_at": string,"family_id": string,"recipe_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"family_id": string,"recipe_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"family_id"?: string,"recipe_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_favourites_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_favourites_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_favourites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"recipes": {
                  Row: {
                    "cook_minutes": number | null,"created_at": string,"created_by": string | null,"description": string,"emoji": string,"family_id": string,"id": string,"ingredients": (string)[],"is_idea": boolean,"kind": string,"notes": string,"photo_path": string | null,"prep_minutes": number | null,"servings": number | null,"source_url": string | null,"steps": (string)[],"tags": (string)[],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cook_minutes"?: number | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"emoji"?: string,"family_id": string,"id"?: string,"ingredients"?: (string)[],"is_idea"?: boolean,"kind"?: string,"notes"?: string,"photo_path"?: string | null,"prep_minutes"?: number | null,"servings"?: number | null,"source_url"?: string | null,"steps"?: (string)[],"tags"?: (string)[],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "cook_minutes"?: number | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"emoji"?: string,"family_id"?: string,"id"?: string,"ingredients"?: (string)[],"is_idea"?: boolean,"kind"?: string,"notes"?: string,"photo_path"?: string | null,"prep_minutes"?: number | null,"servings"?: number | null,"source_url"?: string | null,"steps"?: (string)[],"tags"?: (string)[],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"seen_items": {
                  Row: {
                    "family_id": string,"item_id": string,"item_type": string,"seen_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "family_id": string,"item_id": string,"item_type": string,"seen_at"?: string,"user_id": string
                  }
                  Update: {
                    "family_id"?: string,"item_id"?: string,"item_type"?: string,"seen_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seen_items_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seen_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_items": {
                  Row: {
                    "added_by": string | null,"aisle": string,"checked": boolean,"checked_at": string | null,"checked_by": string | null,"created_at": string,"family_id": string,"for_recipes": (string)[],"id": string,"name": string,"quantity": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"aisle"?: string,"checked"?: boolean,"checked_at"?: string | null,"checked_by"?: string | null,"created_at"?: string,"family_id": string,"for_recipes"?: (string)[],"id"?: string,"name": string,"quantity"?: string,"source"?: string
                  }
                  Update: {
                    "added_by"?: string | null,"aisle"?: string,"checked"?: boolean,"checked_at"?: string | null,"checked_by"?: string | null,"created_at"?: string,"family_id"?: string,"for_recipes"?: (string)[],"id"?: string,"name"?: string,"quantity"?: string,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_items_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_items_checked_by_fkey"
      columns: ["checked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_items_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"task_assignees": {
                  Row: {
                    "assigned_at": string,"assigned_by": string | null,"family_id": string,"task_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"family_id": string,"task_id": string,"user_id": string
                  }
                  Update: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"family_id"?: string,"task_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_assignees_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_assignees_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_assignees_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_assignees_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"task_completions": {
                  Row: {
                    "completed_at": string,"completed_by": string | null,"family_id": string,"for_user": string | null,"id": string,"occurrence_date": string,"points": number,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string,"completed_by"?: string | null,"family_id": string,"for_user"?: string | null,"id"?: string,"occurrence_date": string,"points"?: number,"task_id": string
                  }
                  Update: {
                    "completed_at"?: string,"completed_by"?: string | null,"family_id"?: string,"for_user"?: string | null,"id"?: string,"occurrence_date"?: string,"points"?: number,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_completions_completed_by_fkey"
      columns: ["completed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_completions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_completions_for_user_fkey"
      columns: ["for_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_completions_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "archived_at": string | null,"category_id": string | null,"colour": string | null,"completion_mode": string,"created_at": string,"created_by": string | null,"due_time": string | null,"emoji": string,"family_id": string,"id": string,"notes": string,"points": number,"reminder_minutes": number | null,"repeat": string,"repeat_days": (number)[],"repeat_until": string | null,"start_date": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"category_id"?: string | null,"colour"?: string | null,"completion_mode"?: string,"created_at"?: string,"created_by"?: string | null,"due_time"?: string | null,"emoji"?: string,"family_id": string,"id"?: string,"notes"?: string,"points"?: number,"reminder_minutes"?: number | null,"repeat"?: string,"repeat_days"?: (number)[],"repeat_until"?: string | null,"start_date": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"category_id"?: string | null,"colour"?: string | null,"completion_mode"?: string,"created_at"?: string,"created_by"?: string | null,"due_time"?: string | null,"emoji"?: string,"family_id"?: string,"id"?: string,"notes"?: string,"points"?: number,"reminder_minutes"?: number | null,"repeat"?: string,"repeat_days"?: (number)[],"repeat_until"?: string | null,"start_date"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_default_categories":
{ Args: { "fid": string }; Returns: undefined
                           },
"add_default_event_types":
{ Args: { "fid": string }; Returns: undefined
                           },
"apply_event_fields":
{ Args: { "d": Json,"e": Omit<Database["public"]['Tables']["events"]['Row'], Database["public"]['Tables']["events"]['ComputedFields']> }; Returns: {
              "all_day": boolean,
"colour": string | null,
"created_at": string,
"created_by": string | null,
"end_date": string,
"end_time": string | null,
"family_id": string,
"id": string,
"location": string,
"notes": string,
"reminder_minutes": number | null,
"repeat": string,
"repeat_until": string | null,
"start_date": string,
"start_time": string | null,
"title": string,
"type_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "events"
        isOneToOne: true
        isSetofReturn: false
      } },
"apply_task_fields":
{ Args: { "d": Json,"t": Omit<Database["public"]['Tables']["tasks"]['Row'], Database["public"]['Tables']["tasks"]['ComputedFields']> }; Returns: {
              "archived_at": string | null,
"category_id": string | null,
"colour": string | null,
"completion_mode": string,
"created_at": string,
"created_by": string | null,
"due_time": string | null,
"emoji": string,
"family_id": string,
"id": string,
"notes": string,
"points": number,
"reminder_minutes": number | null,
"repeat": string,
"repeat_days": (number)[],
"repeat_until": string | null,
"start_date": string,
"title": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"can_add":
{ Args: { "fid": string,"what": string }; Returns: boolean
                           },
"can_complete":
{ Args: { "p_for_user": string,"tid": string }; Returns: boolean
                           },
"can_manage_event":
{ Args: { "eid": string }; Returns: boolean
                           },
"can_manage_recipe":
{ Args: { "rid": string }; Returns: boolean
                           },
"can_manage_task":
{ Args: { "tid": string }; Returns: boolean
                           },
"clean_text":
{ Args: { "max_len": number,"t": string }; Returns: string
                           },
"clean_text_array":
{ Args: { "a": (string)[],"max_items": number,"max_len": number }; Returns: (string)[]
                           },
"create_event":
{ Args: { "p_attendees"?: (string)[],"p_data": Json,"p_family": string }; Returns: string
                           },
"create_family":
{ Args: { "p_colour"?: string,"p_name": string,"p_timezone"?: string }; Returns: string
                           },
"create_task":
{ Args: { "p_assignees"?: (string)[],"p_data": Json,"p_family": string }; Returns: string
                           },
"delete_task":
{ Args: { "p_keep_history"?: boolean,"p_task": string }; Returns: undefined
                           },
"family_today":
{ Args: { "fid": string }; Returns: string
                           },
"friendly_time":
{ Args: { "t": string }; Returns: string
                           },
"generate_due_notifications":
{ Args: { "p_now"?: string,"p_window"?: string }; Returns: number
                           },
"generate_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_family_admin":
{ Args: { "fid": string }; Returns: boolean
                           },
"is_family_member":
{ Args: { "fid": string }; Returns: boolean
                           },
"join_family":
{ Args: { "p_code": string,"p_colour"?: string }; Returns: string
                           },
"mark_seen":
{ Args: { "p_family": string,"p_ids": (string)[],"p_type": string }; Returns: undefined
                           },
"notify":
{ Args: { "p_actor": string,"p_body": string,"p_dedupe": string,"p_family": string,"p_kind": string,"p_link": string,"p_title": string,"p_user": string }; Returns: undefined
                           },
"occurs_on":
{ Args: { "p_date": string,"p_days": (number)[],"p_repeat": string,"p_start": string,"p_until": string }; Returns: boolean
                           },
"prefs_for":
{ Args: { "p_family": string,"p_user": string }; Returns: {
              "assignment_alerts": boolean,
"daily_summary": boolean,
"daily_summary_time": string,
"event_reminders": boolean,
"family_id": string,
"new_recipe_alerts": boolean,
"task_reminders": boolean,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "notification_prefs"
        isOneToOne: true
        isSetofReturn: false
      } },
"regenerate_invite_code":
{ Args: { "p_family": string }; Returns: string
                           },
"remove_member":
{ Args: { "p_family": string,"p_user": string }; Returns: undefined
                           },
"safe_text":
{ Args: { "t": string }; Returns: string
                           },
"send_test_notification":
{ Args: { "p_family": string }; Returns: string
                           },
"set_event_attendees":
{ Args: { "p_attendees": (string)[],"p_event": string }; Returns: undefined
                           },
"set_task_assignees":
{ Args: { "p_assignees": (string)[],"p_task": string }; Returns: undefined
                           },
"shares_family_with":
{ Args: { "uid": string }; Returns: boolean
                           },
"task_occurs_on":
{ Args: { "p_date": string,"p_task": Omit<Database["public"]['Tables']["tasks"]['Row'], Database["public"]['Tables']["tasks"]['ComputedFields']> }; Returns: boolean
                           },
"try_uuid":
{ Args: { "t": string }; Returns: string
                           },
"update_event":
{ Args: { "p_attendees"?: (string)[],"p_data": Json,"p_event": string }; Returns: string
                           },
"update_member":
{ Args: { "p_colour"?: string,"p_family": string,"p_role"?: Database["public"]['Enums']["family_role"],"p_user": string }; Returns: undefined
                           },
"update_task":
{ Args: { "p_assignees"?: (string)[],"p_data": Json,"p_task": string }; Returns: string
                           },
"user_in_family":
{ Args: { "fid": string,"uid": string }; Returns: boolean
                           }
          }
          Enums: {
            "family_role": "admin"|"member"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "family_role": ["admin", "member"]
          }
        }
} as const
