import React, { useState, useEffect } from 'react';
import mondaySdk from 'monday-sdk-js';

const monday = mondaySdk();

/**
 * Component to display subscription status and handle subscription-related UI
 * Required for Monday.com monetization compliance
 */
function SubscriptionStatus({ accountId, onStatusChange }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch subscription status on component mount
  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      try {
        setLoading(true);
        
        // Get session token from Monday SDK
        const tokenRes = await monday.get('sessionToken');
        const token = tokenRes.data;
        
        // Call backend API to get subscription status
        const result = await monday.api(`/subscription/${accountId}`, {
          method: 'get',
          headers: {
            'x-monday-session-token': token
          }
        });
        
        setSubscription(result.data);
        
        // Notify parent component of status change
        if (onStatusChange) {
          onStatusChange(result.data);
        }
      } catch (err) {
        console.error('Error fetching subscription status:', err);
        setError('Failed to load subscription information');
      } finally {
        setLoading(false);
      }
    };
    
    if (accountId) {
      fetchSubscriptionStatus();
    }
  }, [accountId, onStatusChange]);
  
  // Handle upgrade button click
  const handleUpgrade = () => {
    monday.execute('openAppBillingSection', { isInPlanSelection: true });
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="subscription-status loading">
        <div className="loading-spinner"></div>
        <p>Loading subscription information...</p>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="subscription-status error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }
  
  // If no subscription found, render default state
  if (!subscription) {
    return (
      <div className="subscription-status not-subscribed">
        <p>No active subscription found.</p>
        <button onClick={handleUpgrade} className="upgrade-button">
          Get Started
        </button>
      </div>
    );
  }
  
  // Render active subscription
  const { subscription: sub, features, limits } = subscription;
  const isProOrEnterprise = sub.planId === 'pro_plan' || sub.planId === 'enterprise_plan';
  
  // Helper function to format plan ID for display
  const formatPlanName = (planId) => {
    switch (planId) {
      case 'free_trial':
        return 'Free Trial';
      case 'basic_plan':
        return 'Basic Plan';
      case 'pro_plan':
        return 'Pro Plan';
      case 'enterprise_plan':
        return 'Enterprise Plan';
      default:
        return planId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };
  
  // Helper function to format usage limit
  const formatLimit = (limit) => {
    return limit === -1 ? 'Unlimited' : limit;
  };
  
  return (
    <div className="subscription-status active">
      <div className="subscription-header">
        <h3>Your Subscription</h3>
        <span className={`plan-badge ${sub.planId.replace('_', '-')}`}>
          {formatPlanName(sub.planId)}
        </span>
      </div>
      
      {sub.isOnTrial && (
        <div className="trial-notice">
          <p>You are currently on a free trial.</p>
        </div>
      )}
      
      <div className="subscription-details">
        <div className="usage-info">
          <h4>Usage</h4>
          <p>Requests: {limits.usageCount} / {formatLimit(limits.maxRequests)}</p>
          {!isProOrEnterprise && (
            <button onClick={handleUpgrade} className="upgrade-button">
              Upgrade Plan
            </button>
          )}
        </div>
        
        <div className="feature-list">
          <h4>Available Features</h4>
          <ul>
            {Object.entries(features).map(([feature, available]) => (
              <li key={feature} className={available ? 'available' : 'unavailable'}>
                <span className={`feature-icon ${available ? 'check' : 'x'}`}>
                  {available ? '✓' : '✗'}
                </span>
                <span className="feature-name">
                  {feature.replace(/([A-Z])/g, ' $1')
                    .replace(/^./, str => str.toUpperCase())}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="subscription-actions">
        <button onClick={() => monday.execute('openAppBillingSection')} className="manage-button">
          Manage Subscription
        </button>
      </div>
    </div>
  );
}

export default SubscriptionStatus;