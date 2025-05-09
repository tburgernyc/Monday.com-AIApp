import { useState, useEffect } from 'react';
import mondaySdk from 'monday-sdk-js';

const monday = mondaySdk();

/**
 * Custom hook to fetch and manage subscription status
 * 
 * @param {string} accountId - Monday.com account ID
 * @returns {Object} - Subscription data, loading state, and error
 */
function useSubscription(accountId) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        if (!accountId) {
          setLoading(false);
          return;
        }
        
        setLoading(true);
        setError(null);
        
        // Get session token from Monday SDK
        const tokenRes = await monday.get('sessionToken');
        const token = tokenRes.data;
        
        // Call backend API to get subscription status
        const result = await monday.api(`/api/subscription/${accountId}`, {
          method: 'get',
          headers: {
            'x-monday-session-token': token
          }
        });
        
        setSubscription(result.data);
      } catch (err) {
        console.error('Error fetching subscription:', err);
        setError('Failed to load subscription information');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSubscription();
  }, [accountId]);
  
  /**
   * Check if a feature is available in the current subscription
   * 
   * @param {string} feature - Feature name to check
   * @returns {boolean} - Whether the feature is available
   */
  const hasFeature = (feature) => {
    if (!subscription || !subscription.subscription.isActive) {
      return false;
    }
    
    return subscription.features && subscription.features[feature] === true;
  };
  
  /**
   * Check if the subscription has reached its request limit
   * 
   * @returns {boolean} - Whether the subscription has reached its limit
   */
  const hasReachedLimit = () => {
    if (!subscription) {
      return true; // Assume limit reached if no subscription data
    }
    
    if (!subscription.subscription.isActive) {
      return true;
    }
    
    // -1 means unlimited requests
    return subscription.limits.maxRequests !== -1 && 
           subscription.limits.usageCount >= subscription.limits.maxRequests;
  };
  
  /**
   * Increment the usage count for the subscription
   * 
   * @returns {Promise<boolean>} - Whether the increment was successful
   */
  const incrementUsage = async () => {
    try {
      if (!accountId) {
        return false;
      }
      
      // Get session token
      const tokenRes = await monday.get('sessionToken');
      const token = tokenRes.data;
      
      // Call API to increment usage
      await monday.api(`/api/subscription/${accountId}/increment`, {
        method: 'post',
        headers: {
          'x-monday-session-token': token
        }
      });
      
      // Update local subscription data
      setSubscription(prev => {
        if (!prev) return prev;
        
        return {
          ...prev,
          limits: {
            ...prev.limits,
            usageCount: (prev.limits.usageCount || 0) + 1
          }
        };
      });
      
      return true;
    } catch (err) {
      console.error('Error incrementing usage:', err);
      
      // Check if error is due to reaching limit
      if (err.response && err.response.status === 402) {
        setSubscription(prev => {
          if (!prev) return prev;
          
          return {
            ...prev,
            limits: {
              ...prev.limits,
              usageCount: prev.limits.maxRequests // Set to max to indicate limit reached
            }
          };
        });
      }
      
      return false;
    }
  };
  
  /**
   * Format subscription plan name for display
   * 
   * @returns {string} - Formatted plan name
   */
  const getPlanName = () => {
    if (!subscription) return '';
    
    const planId = subscription.subscription.planId;
    
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
  
  /**
   * Open the Monday.com billing section
   * 
   * @param {boolean} isInPlanSelection - Whether to open the plan selection screen
   */
  const openBillingSection = (isInPlanSelection = false) => {
    monday.execute('openAppBillingSection', { isInPlanSelection });
  };
  
  return {
    subscription,
    loading,
    error,
    hasFeature,
    hasReachedLimit,
    incrementUsage,
    getPlanName,
    openBillingSection
  };
}

export default useSubscription;