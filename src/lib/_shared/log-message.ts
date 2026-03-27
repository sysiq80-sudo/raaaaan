/**
 * Shared Bot Message Logger
 * Utility for logging bot conversation messages across all platforms
 */

import { supabase } from '@/integrations/supabase/client';

export interface BotMessageData {
  botCustomerId: string;
  message: string;
  platform: 'whatsapp' | 'telegram' | 'sms';
  messageId?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an incoming message from a customer to the bot
 */
export async function logIncomingBotMessage(data: BotMessageData): Promise<string | null> {
  try {
    const { data: result, error } = await supabase.rpc('log_bot_incoming_message', {
      p_bot_customer_id: data.botCustomerId,
      p_message: data.message,
      p_platform: data.platform,
      p_message_id: data.messageId || null,
      p_metadata: data.metadata || {}
    });

    if (error) {
      console.error('Failed to log incoming bot message:', error);
      return null;
    }

    return result;
  } catch (err) {
    console.error('Error logging incoming bot message:', err);
    return null;
  }
}

/**
 * Log an outgoing message from the bot to a customer
 */
export async function logOutgoingBotMessage(data: BotMessageData): Promise<string | null> {
  try {
    const { data: result, error } = await supabase.rpc('log_bot_outgoing_message', {
      p_bot_customer_id: data.botCustomerId,
      p_message: data.message,
      p_platform: data.platform,
      p_message_id: data.messageId || null,
      p_metadata: data.metadata || {}
    });

    if (error) {
      console.error('Failed to log outgoing bot message:', error);
      return null;
    }

    return result;
  } catch (err) {
    console.error('Error logging outgoing bot message:', err);
    return null;
  }
}

/**
 * Get conversation history for a bot customer
 */
export async function getBotConversationHistory(
  botCustomerId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const { data, error } = await supabase.rpc('get_bot_conversation_history', {
      p_bot_customer_id: botCustomerId,
      p_limit: limit
    });

    if (error) {
      console.error('Failed to get bot conversation history:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error getting bot conversation history:', err);
    return [];
  }
}

/**
 * Get recent conversations for admin dashboard
 */
export async function getRecentBotConversations(limit: number = 20): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('bot_conversation_messages')
      .select(`
        id,
        message,
        direction,
        platform,
        created_at,
        metadata,
        bot_customers (
          id,
          display_name,
          phone_number,
          platform,
          platform_id,
          last_active
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to get recent bot conversations:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error getting recent bot conversations:', err);
    return [];
  }
}

/**
 * Get conversation stats for dashboard
 */
export async function getBotConversationStats(): Promise<{
  totalMessages: number;
  totalConversations: number;
  messagesByPlatform: Record<string, number>;
  recentActivity: number;
}> {
  try {
    // Get total messages
    const { count: totalMessages } = await supabase
      .from('bot_conversation_messages')
      .select('*', { count: 'exact', head: true });

    // Get unique conversations (unique bot customers with messages)
    const { data: conversations } = await supabase
      .from('bot_conversation_messages')
      .select('bot_customer_id')
      .then(result => {
        const uniqueCustomers = new Set(result.data?.map(r => r.bot_customer_id) || []);
        return { data: Array.from(uniqueCustomers) };
      });

    // Get messages by platform
    const { data: platformStats } = await supabase
      .from('bot_conversation_messages')
      .select('platform')
      .then(result => {
        const stats: Record<string, number> = {};
        result.data?.forEach(row => {
          stats[row.platform] = (stats[row.platform] || 0) + 1;
        });
        return { data: stats };
      });

    // Get recent activity (messages in last 24 hours)
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const { count: recentActivity } = await supabase
      .from('bot_conversation_messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString());

    return {
      totalMessages: totalMessages || 0,
      totalConversations: conversations?.length || 0,
      messagesByPlatform: platformStats || {},
      recentActivity: recentActivity || 0
    };
  } catch (err) {
    console.error('Error getting bot conversation stats:', err);
    return {
      totalMessages: 0,
      totalConversations: 0,
      messagesByPlatform: {},
      recentActivity: 0
    };
  }
}