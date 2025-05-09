import React, { useState } from 'react';
import './ConversationHistory.css';

/**
 * Conversation History Component
 * 
 * Displays previous conversations and allows the user to select and continue from them
 * 
 * @param {Object} props - Component props
 * @param {Array} props.history - Array of conversation history items
 * @param {Function} props.onSelectConversation - Callback when a conversation is selected
 * @param {Function} props.onClearHistory - Callback to clear history
 * @param {Boolean} props.loading - Whether history is being loaded
 */
function ConversationHistory({ history = [], onSelectConversation, onClearHistory, loading = false }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItemId, setExpandedItemId] = useState(null);
  
  // Filter history based on search query
  const filteredHistory = searchQuery
    ? history.filter(item => 
        item.prompt.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (item.explanation && item.explanation.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : history;
  
  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };
  
  // Handle clicking on a conversation item
  const handleItemClick = (item) => {
    if (expandedItemId === item.id) {
      setExpandedItemId(null);
    } else {
      setExpandedItemId(item.id);
    }
  };
  
  // Handle selecting a conversation
  const handleSelectConversation = (item) => {
    if (onSelectConversation) {
      onSelectConversation(item);
    }
    setExpandedItemId(null);
  };
  
  // Handle clearing history
  const handleClearHistory = () => {
    if (onClearHistory) {
      if (window.confirm('Are you sure you want to clear your conversation history?')) {
        onClearHistory();
      }
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Truncate text
  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="conversation-history loading">
        <div className="history-header">
          <h3>Conversation History</h3>
        </div>
        <div className="loading-indicator">
          <div className="loading-spinner"></div>
          <p>Loading conversation history...</p>
        </div>
      </div>
    );
  }
  
  // Render empty state
  if (!filteredHistory.length) {
    return (
      <div className="conversation-history empty">
        <div className="history-header">
          <h3>Conversation History</h3>
          <div className="history-search">
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
        </div>
        <div className="empty-message">
          {searchQuery 
            ? "No conversations match your search." 
            : "No previous conversations found."}
        </div>
      </div>
    );
  }
  
  return (
    <div className="conversation-history">
      <div className="history-header">
        <h3>Conversation History</h3>
        <div className="history-actions">
          <div className="history-search">
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
          <button 
            className="clear-history-button"
            onClick={handleClearHistory}
            title="Clear all history"
          >
            Clear All
          </button>
        </div>
      </div>
      
      <ul className="history-list">
        {filteredHistory.map((item) => (
          <li 
            key={item.id} 
            className={`history-item ${expandedItemId === item.id ? 'expanded' : ''}`}
          >
            <div className="history-item-header" onClick={() => handleItemClick(item)}>
              <div className="history-item-prompt">
                {truncateText(item.prompt, 60)}
              </div>
              <div className="history-item-timestamp">
                {formatTimestamp(item.timestamp)}
              </div>
            </div>
            
            {expandedItemId === item.id && (
              <div className="history-item-details">
                <div className="history-item-full-prompt">
                  <strong>Your request:</strong>
                  <p>{item.prompt}</p>
                </div>
                
                {item.explanation && (
                  <div className="history-item-response">
                    <strong>Claude's response:</strong>
                    <p>{truncateText(item.explanation, 200)}</p>
                  </div>
                )}
                
                <button 
                  className="continue-button"
                  onClick={() => handleSelectConversation(item)}
                >
                  Continue from this conversation
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ConversationHistory;