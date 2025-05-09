import React, { useState, useEffect } from 'react';
import mondaySdk from 'monday-sdk-js';
import './BoardHeaderAIAssistant.css';

const monday = mondaySdk();

/**
 * Board Header AI Assistant Component
 * 
 * This component implements the Board Header AI Assistant feature for monday.com.
 * It provides a natural language interface for managing monday.com boards, items,
 * and workflows using Claude's AI capabilities.
 */
function BoardHeaderAIAssistant() {
  const [userPrompt, setUserPrompt] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [context, setContext] = useState({
    boardId: null,
    userId: null,
    accountId: null
  });
  const [subscription, setSubscription] = useState(null);

  // Initialize and get context from monday.com
  useEffect(() => {
    monday.listen('context', (res) => {
      setContext({
        boardId: res.data.boardId,
        userId: res.data.user.id,
        accountId: res.data.account.id
      });
    });
    
    // Get context
    monday.execute('get', { type: 'context' });
  }, []);

  // Get subscription status when context changes
  useEffect(() => {
    const fetchSubscription = async () => {
      if (context.accountId) {
        try {
          const tokenRes = await monday.get('sessionToken');
          const token = tokenRes.data;
          
          const result = await monday.api(`/api/subscription/${context.accountId}`, {
            method: 'get',
            headers: {
              'x-monday-session-token': token
            }
          });
          
          setSubscription(result.data);
        } catch (err) {
          console.error('Error fetching subscription:', err);
        }
      }
    };
    
    fetchSubscription();
  }, [context.accountId]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!userPrompt.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get session token
      const tokenRes = await monday.get('sessionToken');
      const token = tokenRes.data;
      
      // Check subscription status
      if (subscription && 
          (!subscription.subscription.isActive || 
           subscription.limits.usageCount >= subscription.limits.maxRequests)) {
        setError('You have reached your subscription limit. Please upgrade your plan to continue using Claude AI Assistant.');
        setLoading(false);
        return;
      }
      
      // Increment usage counter
      await monday.api(`/api/subscription/${context.accountId}/increment`, {
        method: 'post',
        headers: {
          'x-monday-session-token': token
        }
      });
      
      // Send the request to our backend service
      const result = await monday.api('/api/process-request', {
        method: 'post',
        body: {
          userPrompt,
          userId: context.userId,
          accountId: context.accountId,
          boardId: context.boardId
        }
      });
      
      setResponse(result.data);
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to process your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render welcome content if no response yet
  const renderWelcome = () => (
    <div className="welcome-container">
      <h2>👋 Welcome to Claude AI Assistant</h2>
      <p>
        Use natural language to manage your monday.com boards, items, and workflows.
        Just type what you want to do and Claude will help you get it done.
      </p>
      <div className="examples">
        <h3>Examples:</h3>
        <ul>
          <li>"Create a new item called Website Redesign with a status of In Progress"</li>
          <li>"Show all items with status Stuck"</li>
          <li>"Add a subitem called Header Design to the Website Redesign item"</li>
          <li>"Move all completed items to the Done group"</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="board-header-ai-assistant">
      <form onSubmit={handleSubmit} className="prompt-form">
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="Ask Claude to manage your board using natural language..."
          rows={3}
          className="prompt-input"
        />
        <button 
          type="submit" 
          className="submit-button"
          disabled={loading || !userPrompt.trim()}
        >
          {loading ? 'Processing...' : 'Submit'}
        </button>
      </form>
      
      {error && (
        <div className="error-message">
          {error}
          {subscription && !subscription.subscription.isActive && (
            <button 
              onClick={() => monday.execute('openAppBillingSection', { isInPlanSelection: true })}
              className="upgrade-button"
            >
              Upgrade Plan
            </button>
          )}
        </div>
      )}
      
      {!response && !loading && !error && renderWelcome()}
      
      {response && (
        <div className="response-container">
          {response.explanation ? (
            <>
              <div className="explanation">
                <h3>Result:</h3>
                <p>{response.explanation}</p>
              </div>
              
              {response.result && (
                <div className="technical-details">
                  <h4>Technical Details:</h4>
                  <pre>{JSON.stringify(response.result, null, 2)}</pre>
                </div>
              )}
            </>
          ) : (
            <p>{response.message || 'No response generated.'}</p>
          )}
        </div>
      )}
      
      {subscription && (
        <div className="subscription-info">
          <p>
            Plan: <strong>{subscription.subscription.planId.replace('_', ' ').toUpperCase()}</strong> | 
            Requests used: <strong>{subscription.limits.usageCount} / {subscription.limits.maxRequests === -1 ? 'Unlimited' : subscription.limits.maxRequests}</strong>
            {!subscription.subscription.isActive && ' (Inactive)'}
          </p>
          {(!subscription.subscription.isActive || subscription.limits.usageCount >= subscription.limits.maxRequests) && (
            <button 
              onClick={() => monday.execute('openAppBillingSection', { isInPlanSelection: true })}
              className="upgrade-button"
            >
              Upgrade Plan
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default BoardHeaderAIAssistant;