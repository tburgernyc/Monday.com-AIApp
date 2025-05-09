import React, { useState, useEffect } from 'react';
import mondaySdk from 'monday-sdk-js';
import './DocAction.css';

const monday = mondaySdk();

/**
 * Document Action Component
 * 
 * This component allows users to perform AI-powered actions on documents
 * such as summarization, analysis, and extraction using Claude.
 * 
 * @param {Object} props - Component props
 * @param {string} props.initialDocument - Initial document content
 * @param {Function} props.onProcess - Callback after processing
 * @param {Function} props.onApply - Callback when applying results
 * @param {Function} props.onCancel - Callback when canceling
 */
function DocAction({ initialDocument = '', onProcess, onApply, onCancel }) {
  // State variables
  const [document, setDocument] = useState(initialDocument);
  const [action, setAction] = useState('summarize');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [context, setContext] = useState({
    userId: null,
    accountId: null
  });

  // Initialize and get context from monday.com
  useEffect(() => {
    monday.listen('context', (res) => {
      setContext({
        userId: res.data.user.id,
        accountId: res.data.account.id
      });
    });
    
    // Get context
    monday.execute('get', { type: 'context' });
  }, []);

  // Available actions for the dropdown
  const actions = [
    { id: 'summarize', label: 'Summarize' },
    { id: 'analyze', label: 'Analyze' },
    { id: 'extract_key_points', label: 'Extract Key Points' },
    { id: 'extract_action_items', label: 'Extract Action Items' },
    { id: 'simplify', label: 'Simplify Language' }
  ];

  // Handle document input change
  const handleDocumentChange = (e) => {
    setDocument(e.target.value);
    // Clear previous results when document changes
    if (result) {
      setResult(null);
    }
  };

  // Handle action selection change
  const handleActionChange = (e) => {
    setAction(e.target.value);
    // Clear previous results when changing action
    if (result) {
      setResult(null);
    }
  };

  // Process the document with selected action
  const handleProcess = async () => {
    if (!document.trim()) {
      setError('Please enter a document to process');
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      // Get session token
      const tokenRes = await monday.get('sessionToken');
      const token = tokenRes.data;
      
      // Check subscription status
      const subscriptionRes = await monday.api(`/api/subscription/${context.accountId}`, {
        method: 'get',
        headers: {
          'x-monday-session-token': token
        }
      });
      
      const subscription = subscriptionRes.data;
      
      // Check if user has reached their limit
      if (!subscription.subscription.isActive || 
          (subscription.limits.maxRequests !== -1 && 
           subscription.limits.usageCount >= subscription.limits.maxRequests)) {
        setError('You have reached your subscription limit. Please upgrade your plan to continue using this feature.');
        setIsProcessing(false);
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
      const apiResult = await monday.execute('api', {
        endpoint: '/api/process-document',
        method: 'post',
        body: {
          document,
          action,
          userId: context.userId,
          accountId: context.accountId
        }
      });
      
      setResult(apiResult.data.result);
      
      // Call onProcess callback if provided
      if (onProcess) {
        onProcess(apiResult.data);
      }
    } catch (err) {
      console.error('Error processing document:', err);
      setError('Failed to process your document. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle apply button click
  const handleApply = () => {
    if (onApply && result) {
      onApply(result);
    }
  };

  // Handle cancel button click
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      // Reset the component if no cancel callback
      setDocument(initialDocument);
      setAction('summarize');
      setResult(null);
      setError(null);
    }
  };

  return (
    <div className="doc-action">
      <h2>Document Actions with Claude AI</h2>
      
      <div className="input-section">
        <label htmlFor="document-input">Document Text</label>
        <textarea
          id="document-input"
          value={document}
          onChange={handleDocumentChange}
          placeholder="Paste your document text here..."
          disabled={isProcessing}
        />
      </div>
      
      <div className="action-selection">
        <label htmlFor="action-select">Select Action:</label>
        <select
          id="action-select"
          value={action}
          onChange={handleActionChange}
          disabled={isProcessing}
        >
          {actions.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        
        <button
          className="process-button"
          onClick={handleProcess}
          disabled={isProcessing || !document.trim()}
        >
          {isProcessing ? 'Processing...' : 'Process'}
        </button>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {result && (
        <div className="result-section">
          <h3>Result</h3>
          <div className="result-content">
            {result}
          </div>
          
          <div className="action-buttons">
            <button className="apply-button" onClick={handleApply}>
              Apply
            </button>
            <button className="cancel-button" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocAction;