import { useState, useEffect } from 'react';
import mondaySdk from 'monday-sdk-js';

const monday = mondaySdk();

/**
 * Custom hook to fetch and manage conversation history
 * 
 * @param {string} userId - Monday.com user ID
 * @returns {Object} - Conversation history data, loading state, and functions
 */
function useConversationHistory(userId) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch conversation history on mount and when userId changes
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        if (!userId) {
          setLoading(false);
          return;
        }
        
        setLoading(true);
        setError(null);
        
        // Get session token from Monday SDK
        const tokenRes = await monday.get('sessionToken');
        const token = tokenRes.data;
        
        // Call API to get conversation history
        const result = await monday.api(`/api/conversation-history/${userId}`, {
          method: 'get',
          headers: {
            'x-monday-session-token': token
          }
        });
        
        setHistory(result.data || []);
      } catch (err) {
        console.error('Error fetching conversation history:', err);
        setError('Failed to load conversation history');
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistory();
  }, [userId]);
  
  /**
   * Clear all conversation history
   * 
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  const clearHistory = async () => {
    try {
      if (!userId) {
        return false;
      }
      
      setLoading(true);
      
      // Get session token
      const tokenRes = await monday.get('sessionToken');
      const token = tokenRes.data;
      
      // Call API to clear history
      await monday.api(`/api/conversation-history/${userId}`, {
        method: 'delete',
        headers: {
          'x-monday-session-token': token
        }
      });
      
      // Clear local history
      setHistory([]);
      
      return true;
    } catch (err) {
      console.error('Error clearing conversation history:', err);
      setError('Failed to clear conversation history');
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Add a new conversation to history
   * 
   * @param {Object} conversation - Conversation to add
   */
  const addToHistory = (conversation) => {
    // Add to the beginning of the array
    setHistory(prev => [conversation, ...prev]);
  };
  
  /**
   * Get a conversation by ID
   * 
   * @param {string} id - Conversation ID
   * @returns {Object|null} - Conversation or null if not found
   */
  const getConversationById = (id) => {
    return history.find(item => item.id === id) || null;
  };
  
  /**
   * Search conversations by query
   * 
   * @param {string} query - Search query
   * @returns {Array} - Filtered conversations
   */
  const searchConversations = (query) => {
    if (!query) {
      return history;
    }
    
    const lowerQuery = query.toLowerCase();
    
    return history.filter(item => 
      item.prompt.toLowerCase().includes(lowerQuery) || 
      (item.explanation && item.explanation.toLowerCase().includes(lowerQuery))
    );
  };
  
  return {
    history,
    loading,
    error,
    clearHistory,
    addToHistory,
    getConversationById,
    searchConversations
  };
}

export default useConversationHistory;