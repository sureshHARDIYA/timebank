export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          email: string;
          hourly_rate_usd: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          email: string;
          hourly_rate_usd?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          email?: string;
          hourly_rate_usd?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          completed: boolean;
          status?: "backlog" | "todo" | "progress" | "done";
          description?: string | null;
          assignee_id?: string | null;
          task_number?: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          completed?: boolean;
          status?: "backlog" | "todo" | "progress" | "done";
          description?: string | null;
          assignee_id?: string | null;
          task_number?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          completed?: boolean;
          status?: "backlog" | "todo" | "progress" | "done";
          description?: string | null;
          assignee_id?: string | null;
          task_number?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      time_entries: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          task_id: string | null;
          task_name: string | null;
          start_time: string;
          end_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id: string;
          task_id?: string | null;
          task_name?: string | null;
          start_time: string;
          end_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string;
          task_id?: string | null;
          task_name?: string | null;
          start_time?: string;
          end_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      active_timers: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          task_id: string | null;
          task_name: string | null;
          started_at: string;
          created_at: string;
          tag_ids: string[];
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          task_id?: string | null;
          task_name?: string | null;
          started_at: string;
          created_at?: string;
          tag_ids?: string[];
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          task_id?: string | null;
          task_name?: string | null;
          started_at?: string;
          created_at?: string;
          tag_ids?: string[];
        };
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          created_at?: string;
        };
      };
      time_entry_tags: {
        Row: {
          time_entry_id: string;
          tag_id: string;
        };
        Insert: {
          time_entry_id: string;
          tag_id: string;
        };
        Update: {
          time_entry_id?: string;
          tag_id?: string;
        };
      };
      task_tags: {
        Row: {
          task_id: string;
          tag_id: string;
        };
        Insert: {
          task_id: string;
          tag_id: string;
        };
        Update: {
          task_id?: string;
          tag_id?: string;
        };
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];
export type ActiveTimer = Database["public"]["Tables"]["active_timers"]["Row"];
export type Tag = Database["public"]["Tables"]["tags"]["Row"];
export type TimeEntryTag = Database["public"]["Tables"]["time_entry_tags"]["Row"];
