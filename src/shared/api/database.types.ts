// Auto-generated database types from PostgreSQL schema
// Generated from supabase/migrations/20240101000000_initial_schema.sql

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["user_role"];
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_invites: {
        Row: {
          id: string;
          workspace_id: string;
          email: string;
          role: Database["public"]["Enums"]["user_role"];
          token_hash: string;
          status: Database["public"]["Enums"]["invite_status"];
          expires_at: string;
          invited_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          email: string;
          role?: Database["public"]["Enums"]["user_role"];
          token_hash: string;
          status?: Database["public"]["Enums"]["invite_status"];
          expires_at?: string;
          invited_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          email?: string;
          role?: Database["public"]["Enums"]["user_role"];
          token_hash?: string;
          status?: Database["public"]["Enums"]["invite_status"];
          expires_at?: string;
          invited_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey";
            columns: ["workspace_id"];
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_invites_invited_by_fkey";
            columns: ["invited_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          slug: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          slug: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_workspace_id_fkey";
            columns: ["workspace_id"];
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      releases: {
        Row: {
          id: string;
          product_id: string;
          version: string;
          title: string;
          description: string | null;
          status: Database["public"]["Enums"]["release_status"];
          planned_at: string | null;
          published_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          row_version: number;
        };
        Insert: {
          id?: string;
          product_id: string;
          version: string;
          title: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["release_status"];
          planned_at?: string | null;
          published_at?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          row_version?: number;
        };
        Update: {
          id?: string;
          product_id?: string;
          version?: string;
          title?: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["release_status"];
          planned_at?: string | null;
          published_at?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          row_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "releases_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "releases_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      release_changes: {
        Row: {
          id: string;
          release_id: string;
          title: string;
          description: string;
          category: Database["public"]["Enums"]["change_category"];
          position: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          release_id: string;
          title: string;
          description: string;
          category: Database["public"]["Enums"]["change_category"];
          position: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          release_id?: string;
          title?: string;
          description?: string;
          category?: Database["public"]["Enums"]["change_category"];
          position?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "release_changes_release_id_fkey";
            columns: ["release_id"];
            referencedRelation: "releases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "release_changes_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      release_reviewers: {
        Row: {
          id: string;
          release_id: string;
          user_id: string;
          decision: string | null;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          release_id: string;
          user_id: string;
          decision?: string | null;
          decided_at?: string | null;
        };
        Update: {
          id?: string;
          release_id?: string;
          user_id?: string;
          decision?: string | null;
          decided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "release_reviewers_release_id_fkey";
            columns: ["release_id"];
            referencedRelation: "releases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "release_reviewers_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          id: string;
          release_id: string;
          user_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          release_id: string;
          user_id?: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          release_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_release_id_fkey";
            columns: ["release_id"];
            referencedRelation: "releases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_events: {
        Row: {
          id: string;
          workspace_id: string;
          release_id: string | null;
          actor_id: string;
          event_type: Database["public"]["Enums"]["event_type"];
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          release_id?: string | null;
          actor_id: string;
          event_type: Database["public"]["Enums"]["event_type"];
          payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          release_id?: string | null;
          actor_id?: string;
          event_type?: Database["public"]["Enums"]["event_type"];
          payload?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_events_workspace_id_fkey";
            columns: ["workspace_id"];
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_events_actor_id_fkey";
            columns: ["actor_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_member: {
        Args: { ws_id: string };
        Returns: boolean;
      };
      is_owner: {
        Args: { ws_id: string };
        Returns: boolean;
      };
      release_workspace: {
        Args: { p_release_id: string };
        Returns: string;
      };
      change_workspace: {
        Args: { p_change_id: string };
        Returns: string;
      };
      create_workspace: {
        Args: { workspace_name: string };
        Returns: string;
      };
      submit_release_for_review: {
        Args: { p_release_id: string; p_reviewer_ids: string[] };
        Returns: unknown;
      };
      approve_release: {
        Args: { p_release_id: string };
        Returns: unknown;
      };
      reject_release: {
        Args: { p_release_id: string };
        Returns: unknown;
      };
      publish_release: {
        Args: { p_release_id: string };
        Returns: unknown;
      };
      reorder_changes: {
        Args: { p_changes: Json };
        Returns: undefined;
      };
      invite_member: {
        Args: { p_workspace_id: string; p_email: string; p_role: Database["public"]["Enums"]["user_role"] };
        Returns: unknown;
      };
      accept_invite: {
        Args: { p_token_hash: string };
        Returns: undefined;
      };
      update_release: {
        Args: {
          p_release_id: string;
          p_expected_version: number;
          p_title?: string | null;
          p_description?: string | null;
          p_planned_at?: string | null;
        };
        Returns: unknown;
      };
      restore_rejected_to_draft: {
        Args: { p_release_id: string };
        Returns: unknown;
      };
      unpublish_release: {
        Args: { p_release_id: string };
        Returns: unknown;
      };
      change_member_role: {
        Args: { p_workspace_id: string; p_user_id: string; p_new_role: Database["public"]["Enums"]["user_role"] };
        Returns: undefined;
      };
      remove_workspace_member: {
        Args: { p_workspace_id: string; p_user_id: string };
        Returns: undefined;
      };
      replace_release_reviewers: {
        Args: { p_release_id: string; p_reviewer_ids: string[] };
        Returns: unknown;
      };
    };
    Enums: {
      user_role: "owner" | "maintainer" | "contributor";
      release_status: "draft" | "review" | "approved" | "rejected" | "published";
      change_category: "feature" | "improvement" | "bugfix" | "security" | "breaking";
      invite_status: "pending" | "accepted" | "expired";
      event_type:
        | "workspace_created"
        | "release_created"
        | "release_submitted"
        | "release_approved"
        | "release_rejected"
        | "release_published"
        | "member_added"
        | "member_removed"
        | "role_changed";
    };
    CompositeTypes: Record<string, never>;
  };
}