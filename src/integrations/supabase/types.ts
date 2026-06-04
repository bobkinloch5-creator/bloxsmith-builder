export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_conversations: {
        Row: {
          created_at: string
          id: string
          project_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          actions: Json | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          actions?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          actions?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          created_at: string
          credits_used: number
          id: number
          metadata: Json
          model: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          id?: number
          metadata?: Json
          model?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          id?: number
          metadata?: Json
          model?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      build_plans: {
        Row: {
          created_at: string
          id: string
          plan: Json
          project_id: string
          prompt: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan: Json
          project_id: string
          prompt: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan?: Json
          project_id?: string
          prompt?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "build_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          name: string
          position: number
          post_role: string
          slug: string
          view_role: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          name: string
          position?: number
          post_role?: string
          slug: string
          view_role?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          name?: string
          position?: number
          post_role?: string
          slug?: string
          view_role?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          chat_id: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string
          id: string
          model: string
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          tx_type: Database["public"]["Enums"]["credit_tx_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          tx_type: Database["public"]["Enums"]["credit_tx_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          tx_type?: Database["public"]["Enums"]["credit_tx_type"]
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      generations: {
        Row: {
          created_at: string
          credits_spent: number
          error: string | null
          id: string
          kind: Database["public"]["Enums"]["generation_kind"]
          model: string | null
          output_data: Json | null
          output_url: string | null
          project_id: string | null
          prompt: string | null
          status: Database["public"]["Enums"]["generation_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_spent?: number
          error?: string | null
          id?: string
          kind: Database["public"]["Enums"]["generation_kind"]
          model?: string | null
          output_data?: Json | null
          output_url?: string | null
          project_id?: string | null
          prompt?: string | null
          status?: Database["public"]["Enums"]["generation_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_spent?: number
          error?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["generation_kind"]
          model?: string | null
          output_data?: Json | null
          output_url?: string | null
          project_id?: string | null
          prompt?: string | null
          status?: Database["public"]["Enums"]["generation_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      global_chat_blocked_words: {
        Row: {
          created_at: string
          created_by: string | null
          match_mode: string
          reason: string | null
          severity: string
          word: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          match_mode?: string
          reason?: string | null
          severity?: string
          word: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          match_mode?: string
          reason?: string | null
          severity?: string
          word?: string
        }
        Relationships: []
      }
      global_chat_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          channel_id: string
          content: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          flagged: boolean
          id: string
          is_announcement: boolean
          pinned_at: string | null
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          channel_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          flagged?: boolean
          id?: string
          is_announcement?: boolean
          pinned_at?: string | null
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          channel_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          flagged?: boolean
          id?: string
          is_announcement?: boolean
          pinned_at?: string | null
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      global_chat_mutes: {
        Row: {
          created_at: string
          created_by: string | null
          muted_until: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          muted_until?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          muted_until?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      global_chat_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      global_chat_reports: {
        Row: {
          created_at: string
          id: string
          message_id: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id?: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string | null
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      global_chat_settings: {
        Row: {
          allow_attachments: boolean
          id: number
          max_message_length: number
          slow_mode_seconds: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_attachments?: boolean
          id?: number
          max_message_length?: number
          slow_mode_seconds?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_attachments?: boolean
          id?: number
          max_message_length?: number
          slow_mode_seconds?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      global_chat_user_prefs: {
        Row: {
          density: string
          font_size: string
          notify_mode: string
          sound_enabled: boolean
          theme_accent: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          density?: string
          font_size?: string
          notify_mode?: string
          sound_enabled?: boolean
          theme_accent?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          density?: string
          font_size?: string
          notify_mode?: string
          sound_enabled?: boolean
          theme_accent?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      global_chat_warnings: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          id: string
          issued_by: string | null
          reason: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          issued_by?: string | null
          reason: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          issued_by?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      mcp_tokens: {
        Row: {
          attempt_count_24h: number
          created_at: string
          label: string | null
          last_attempt_at: string | null
          last_attempt_error: string | null
          last_attempt_ok: boolean | null
          last_client: string | null
          last_used_at: string | null
          last_user_agent: string | null
          token_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count_24h?: number
          created_at?: string
          label?: string | null
          last_attempt_at?: string | null
          last_attempt_error?: string | null
          last_attempt_ok?: boolean | null
          last_client?: string | null
          last_used_at?: string | null
          last_user_agent?: string | null
          token_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count_24h?: number
          created_at?: string
          label?: string | null
          last_attempt_at?: string | null
          last_attempt_error?: string | null
          last_attempt_ok?: boolean | null
          last_client?: string | null
          last_used_at?: string | null
          last_user_agent?: string | null
          token_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      model_generations_3d: {
        Row: {
          cooldown_unlock_at: string | null
          created_at: string
          credits_used: number
          file_path: string | null
          file_url: string | null
          format: string | null
          generation_type: string | null
          id: string
          preview_url: string | null
          project_id: string | null
          prompt: string
          settings: Json
          status: string
          studio_file_path: string | null
          tripo_task_id: string | null
          user_id: string
        }
        Insert: {
          cooldown_unlock_at?: string | null
          created_at?: string
          credits_used?: number
          file_path?: string | null
          file_url?: string | null
          format?: string | null
          generation_type?: string | null
          id?: string
          preview_url?: string | null
          project_id?: string | null
          prompt: string
          settings?: Json
          status?: string
          studio_file_path?: string | null
          tripo_task_id?: string | null
          user_id: string
        }
        Update: {
          cooldown_unlock_at?: string | null
          created_at?: string
          credits_used?: number
          file_path?: string | null
          file_url?: string | null
          format?: string | null
          generation_type?: string | null
          id?: string
          preview_url?: string | null
          project_id?: string | null
          prompt?: string
          settings?: Json
          status?: string
          studio_file_path?: string | null
          tripo_task_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          created_at: string
          credits: number
          id: string
          pack_id: string
          paypal_note: string | null
          paypal_transaction_id: string | null
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credits: number
          id?: string
          pack_id: string
          paypal_note?: string | null
          paypal_transaction_id?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credits?: number
          id?: string
          pack_id?: string
          paypal_note?: string | null
          paypal_transaction_id?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      playtest_runs: {
        Row: {
          applied_actions: Json
          created_at: string
          credits_spent: number
          findings: Json
          id: string
          plan: Json
          project_id: string
          request: string
          rollback_snapshot: Json
          status: string
          summary: string | null
          updated_at: string
          user_id: string
          verification: Json | null
        }
        Insert: {
          applied_actions?: Json
          created_at?: string
          credits_spent?: number
          findings?: Json
          id?: string
          plan?: Json
          project_id: string
          request?: string
          rollback_snapshot?: Json
          status?: string
          summary?: string | null
          updated_at?: string
          user_id: string
          verification?: Json | null
        }
        Update: {
          applied_actions?: Json
          created_at?: string
          credits_spent?: number
          findings?: Json
          id?: string
          plan?: Json
          project_id?: string
          request?: string
          rollback_snapshot?: Json
          status?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
          verification?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "playtest_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plugin_actions: {
        Row: {
          action_type: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          executed_at: string | null
          id: string
          payload: Json | null
          project_id: string
          status: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          payload?: Json | null
          project_id: string
          status?: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          payload?: Json | null
          project_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugin_actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plugin_connections: {
        Row: {
          created_at: string
          id: string
          last_connected_at: string | null
          status: string
          studio_metadata: Json | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_connected_at?: string | null
          status?: string
          studio_metadata?: Json | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_connected_at?: string | null
          status?: string
          studio_metadata?: Json | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      plugin_context: {
        Row: {
          context: Json
          created_at: string
          id: string
          instance_count: number
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          instance_count?: number
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          instance_count?: number
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugin_context_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plugin_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          last_used_at: string | null
          name: string | null
          token_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string | null
          token_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string | null
          token_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          banned: boolean
          banned_at: string | null
          banner_url: string | null
          bio: string | null
          chat_font: string | null
          chat_icon: string | null
          chat_name_gradient: string[] | null
          chat_nickname: string | null
          chat_text_gradient: string[] | null
          created_at: string
          credits: number
          current_activity: Json | null
          custom_background_url: string | null
          discord_claimed: boolean
          display_name: string | null
          email: string | null
          hide_email: boolean
          id: string
          last_seen_at: string | null
          location: string | null
          onboarding_completed_at: string | null
          onboarding_reward_claimed: boolean
          onboarding_step: number | null
          pfp_effect: string
          presence_enabled: boolean
          presence_status: string
          private_profile: boolean
          profile_accent: string | null
          profile_background: string | null
          profile_badges: string[]
          profile_card_color: string
          profile_card_effect: string
          profile_decoration: string
          profile_effect: string | null
          profile_layout: string
          pronouns: string | null
          referral_code: string | null
          referred_by: string | null
          show_activity: boolean
          specialization: string | null
          status_message: string | null
          theme: string | null
          updated_at: string
          user_id: string
          username: string | null
          username_normalized: string | null
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned?: boolean
          banned_at?: string | null
          banner_url?: string | null
          bio?: string | null
          chat_font?: string | null
          chat_icon?: string | null
          chat_name_gradient?: string[] | null
          chat_nickname?: string | null
          chat_text_gradient?: string[] | null
          created_at?: string
          credits?: number
          current_activity?: Json | null
          custom_background_url?: string | null
          discord_claimed?: boolean
          display_name?: string | null
          email?: string | null
          hide_email?: boolean
          id?: string
          last_seen_at?: string | null
          location?: string | null
          onboarding_completed_at?: string | null
          onboarding_reward_claimed?: boolean
          onboarding_step?: number | null
          pfp_effect?: string
          presence_enabled?: boolean
          presence_status?: string
          private_profile?: boolean
          profile_accent?: string | null
          profile_background?: string | null
          profile_badges?: string[]
          profile_card_color?: string
          profile_card_effect?: string
          profile_decoration?: string
          profile_effect?: string | null
          profile_layout?: string
          pronouns?: string | null
          referral_code?: string | null
          referred_by?: string | null
          show_activity?: boolean
          specialization?: string | null
          status_message?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          username_normalized?: string | null
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned?: boolean
          banned_at?: string | null
          banner_url?: string | null
          bio?: string | null
          chat_font?: string | null
          chat_icon?: string | null
          chat_name_gradient?: string[] | null
          chat_nickname?: string | null
          chat_text_gradient?: string[] | null
          created_at?: string
          credits?: number
          current_activity?: Json | null
          custom_background_url?: string | null
          discord_claimed?: boolean
          display_name?: string | null
          email?: string | null
          hide_email?: boolean
          id?: string
          last_seen_at?: string | null
          location?: string | null
          onboarding_completed_at?: string | null
          onboarding_reward_claimed?: boolean
          onboarding_step?: number | null
          pfp_effect?: string
          presence_enabled?: boolean
          presence_status?: string
          private_profile?: boolean
          profile_accent?: string | null
          profile_background?: string | null
          profile_badges?: string[]
          profile_card_color?: string
          profile_card_effect?: string
          profile_decoration?: string
          profile_effect?: string | null
          profile_layout?: string
          pronouns?: string | null
          referral_code?: string | null
          referred_by?: string | null
          show_activity?: boolean
          specialization?: string | null
          status_message?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
          username_normalized?: string | null
        }
        Relationships: []
      }
      project_ai_memories: {
        Row: {
          confidence: number
          created_at: string
          id: string
          key: string
          kind: string
          last_seen_at: string | null
          project_id: string
          score: number
          source_prompt: string | null
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          key: string
          kind?: string
          last_seen_at?: string | null
          project_id: string
          score?: number
          source_prompt?: string | null
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          key?: string
          kind?: string
          last_seen_at?: string | null
          project_id?: string
          score?: number
          source_prompt?: string | null
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_ai_memories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_ai_settings: {
        Row: {
          created_at: string
          mode: string
          model: string | null
          project_id: string
          provider: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          mode?: string
          model?: string | null
          project_id: string
          provider?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          mode?: string
          model?: string | null
          project_id?: string
          provider?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_ai_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_collaborators: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          content: string
          created_at: string
          file_type: string
          id: string
          path: string
          project_id: string
          service_location: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          file_type: string
          id?: string
          path: string
          project_id: string
          service_location: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          file_type?: string
          id?: string
          path?: string
          project_id?: string
          service_location?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json | null
          plan_id: string | null
          position: number
          project_id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json | null
          plan_id?: string | null
          position?: number
          project_id: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json | null
          plan_id?: string | null
          position?: number
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "build_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          data: Json
          description: string | null
          game_type: string | null
          id: string
          is_public: boolean
          name: string
          owner_id: string
          status: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          description?: string | null
          game_type?: string | null
          id?: string
          is_public?: boolean
          name: string
          owner_id: string
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          description?: string | null
          game_type?: string | null
          id?: string
          is_public?: boolean
          name?: string
          owner_id?: string
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          applies_to: string
          code: string
          created_at: string
          created_by: string | null
          credits: number
          discount_percent: number | null
          expires_at: string | null
          id: string
          max_redemptions: number | null
          minimum_amount: number
          promo_type: string
          redemption_count: number
        }
        Insert: {
          active?: boolean
          applies_to?: string
          code: string
          created_at?: string
          created_by?: string | null
          credits?: number
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          minimum_amount?: number
          promo_type?: string
          redemption_count?: number
        }
        Update: {
          active?: boolean
          applies_to?: string
          code?: string
          created_at?: string
          created_by?: string | null
          credits?: number
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          minimum_amount?: number
          promo_type?: string
          redemption_count?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          credits: number
          id: string
          promo_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          credits: number
          id?: string
          promo_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          credits?: number
          id?: string
          promo_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_submissions: {
        Row: {
          created_at: string
          credits_awarded: number
          id: string
          note: string | null
          platform: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_awarded?: number
          id?: string
          note?: string | null
          platform: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_awarded?: number
          id?: string
          note?: string | null
          platform?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      roblox_docs: {
        Row: {
          content: string
          created_at: string
          embedding: string
          id: string
          model: string
          repo_path: string | null
          section: string | null
          sha: string | null
          source: string
          source_url: string
          title: string
          token_count: number | null
        }
        Insert: {
          content: string
          created_at?: string
          embedding: string
          id?: string
          model: string
          repo_path?: string | null
          section?: string | null
          sha?: string | null
          source?: string
          source_url: string
          title: string
          token_count?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          model?: string
          repo_path?: string | null
          section?: string | null
          sha?: string | null
          source?: string
          source_url?: string
          title?: string
          token_count?: number | null
        }
        Relationships: []
      }
      roblox_docs_sync: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          processed: number
          skipped: number
          source: string
          started_at: string
          started_by: string | null
          status: string
          total: number
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          processed?: number
          skipped?: number
          source?: string
          started_at?: string
          started_by?: string | null
          status?: string
          total?: number
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          processed?: number
          skipped?: number
          source?: string
          started_at?: string
          started_by?: string | null
          status?: string
          total?: number
        }
        Relationships: []
      }
      studio_errors: {
        Row: {
          context: Json | null
          created_at: string
          error_message: string
          file_path: string | null
          id: string
          project_id: string
          stack: string | null
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          error_message: string
          file_path?: string | null
          id?: string
          project_id: string
          stack?: string | null
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          error_message?: string
          file_path?: string | null
          id?: string
          project_id?: string
          stack?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_errors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      ui_generations: {
        Row: {
          actions: Json
          category: string
          created_at: string
          files: Json
          id: string
          project_id: string | null
          prompt: string | null
          spec: Json
          style: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: Json
          category: string
          created_at?: string
          files?: Json
          id?: string
          project_id?: string | null
          prompt?: string | null
          spec: Json
          style?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: Json
          category?: string
          created_at?: string
          files?: Json
          id?: string
          project_id?: string | null
          prompt?: string | null
          spec?: Json
          style?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ui_generations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge: string
          created_at: string
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge: string
          created_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge?: string
          created_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_chat_local_mutes: {
        Row: {
          created_at: string
          muted_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          muted_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          muted_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          last_daily_grant_at: string | null
          lifetime_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          last_daily_grant_at?: string | null
          lifetime_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          last_daily_grant_at?: string | null
          lifetime_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_levels: {
        Row: {
          chat_credits_earned: number
          level: number
          messages_sent: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          chat_credits_earned?: number
          level?: number
          messages_sent?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          chat_credits_earned?: number
          level?: number
          messages_sent?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      user_mcp_servers: {
        Row: {
          auth_header: string | null
          created_at: string
          enabled: boolean
          id: string
          last_test_error: string | null
          last_test_ok: boolean | null
          last_tested_at: string | null
          name: string
          tool_count: number | null
          tools_cache: Json | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          auth_header?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_test_error?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          name: string
          tool_count?: number | null
          tools_cache?: Json | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          auth_header?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_test_error?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          name?: string
          tool_count?: number | null
          tools_cache?: Json | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_credits: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: number
      }
      admin_chat_clear_all: { Args: never; Returns: number }
      admin_chat_delete_message: {
        Args: { _message_id: string }
        Returns: undefined
      }
      admin_chat_mute: {
        Args: { _minutes: number; _reason: string; _user_id: string }
        Returns: string
      }
      admin_chat_pin_message: {
        Args: { _message_id: string; _pin: boolean }
        Returns: undefined
      }
      admin_chat_set_slow_mode: { Args: { _seconds: number }; Returns: number }
      admin_chat_unmute: { Args: { _user_id: string }; Returns: undefined }
      admin_chat_warn: {
        Args: { _reason: string; _user_id: string }
        Returns: string
      }
      can_access_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      claim_daily_credits: { Args: never; Returns: Json }
      complete_onboarding: {
        Args: { _reward?: number; _step?: number }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_my_profile: { Args: never; Returns: undefined }
      get_ai_usage: { Args: never; Returns: Json }
      grant_credits_service: {
        Args: { _amount: number; _reason?: string; _user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_project_owner: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      match_roblox_docs: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          repo_path: string
          section: string
          similarity: number
          source: string
          source_url: string
          title: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_promo_code: { Args: { _code: string }; Returns: number }
      refund_credits: {
        Args: { _amount: number; _metadata?: Json; _reason?: string }
        Returns: undefined
      }
      report_chat_user: {
        Args: { _reason?: string; _reported_user_id: string }
        Returns: string
      }
      send_global_chat_message_v2:
        | {
            Args: {
              _attachment_type?: string
              _attachment_url?: string
              _content: string
              _reply_to_id?: string
            }
            Returns: string
          }
        | {
            Args: {
              _attachment_type?: string
              _attachment_url?: string
              _channel_id?: string
              _content: string
              _reply_to_id?: string
            }
            Returns: string
          }
      spend_credits: {
        Args: {
          _amount: number
          _description: string
          _metadata?: Json
          _user_id: string
        }
        Returns: boolean
      }
      spend_credits_atomic: {
        Args: { _amount: number; _description?: string; _metadata?: Json }
        Returns: undefined
      }
      submit_payment_request: {
        Args: {
          _amount: number
          _credits: number
          _pack_id: string
          _paypal_note?: string
          _paypal_transaction_id?: string
        }
        Returns: string
      }
      sync_profile_credits: { Args: { _user_id: string }; Returns: number }
      update_presence: {
        Args: { _activity?: Json; _status?: string }
        Returns: undefined
      }
      validate_purchase_discount: {
        Args: { _amount?: number; _code: string; _pack_id?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "owner"
      credit_tx_type: "grant" | "spend" | "refund" | "purchase" | "daily"
      generation_kind:
        | "image"
        | "model_3d"
        | "script"
        | "map"
        | "ui"
        | "clothing"
        | "other"
      generation_status: "pending" | "running" | "succeeded" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "owner"],
      credit_tx_type: ["grant", "spend", "refund", "purchase", "daily"],
      generation_kind: [
        "image",
        "model_3d",
        "script",
        "map",
        "ui",
        "clothing",
        "other",
      ],
      generation_status: ["pending", "running", "succeeded", "failed"],
    },
  },
} as const
