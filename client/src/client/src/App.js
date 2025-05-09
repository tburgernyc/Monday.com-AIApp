// client/src/App.js
import React, { useState, useEffect } from 'react';
import mondaySdk from 'monday-sdk-js';
import './App.css';

// Initialize the monday SDK
const monday = mondaySdk();

function App() {
  const [userPrompt, setUserPrompt] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [context, setContext] = useState({
    userId: null,
    accountId: null,
    boardInfo: null
  });

  // Initialize and get context from monday.com
  useEffect(() => {
    monday.listen('context', (res) => {
      setContext({
        userId: res.data.user.id,
        accountId: res.data.account.id,
        boardInfo: res.data.board
      });
    });
    
    // Ask monday.com for context
    monday.execute('get', { type: 'context' });
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Send the request to our backend service
      const result = await monday.execute('api', {
        endpoint: '/api/process-request',
        method: 'post',
        body: {
          userPrompt,
          userId: context.userId,
          accountId: context.accountId,
          boardId: context.boardInfo?.id
        }
      });
      
      setResponse(result.data);
    } catch (err) {
      setError('Failed to process your request. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header>
        <h1>Claude AI Assistant for monday.com</h1>
        <p>Ask anything about your boards, items, or workflows in plain English</p>
      </header>
      
      <form onSubmit={handleSubmit}>
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="e.g., 'Create a new item called Project X with a status of In Progress and assign it to John'"
          rows={4}
        />
        <button type="submit" disabled={loading || !userPrompt.trim()}>
          {loading ? 'Processing...' : 'Submit'}
        </button>
      </form>
      
      {error && (
        <div className="error">
          {error}
        </div>
      )}
      
      {response && (
        <div className="response">
          <h2>Response</h2>
          {response.explanation ? (
            <>
              <div className="explanation">
                <h3>What happened:</h3>
                <p>{response.explanation}</p>
              </div>
              
              {response.result && (
                <div className="result">
                  <h3>Result:</h3>
                  <pre>{JSON.stringify(response.result, null, 2)}</pre>
                </div>
              )}
            </>
          ) : (
            <p>{response.message || 'Could not complete the requested action.'}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;