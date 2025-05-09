import { renderHook, act } from '@testing-library/react-hooks';
import mondaySdk from 'monday-sdk-js';
import useSubscription from '../useSubscription';

// Mock monday-sdk-js
jest.mock('monday-sdk-js', () => {
  const mockExecute = jest.fn();
  const mockGet = jest.fn();
  const mockApi = jest.fn();
  const mockListen = jest.fn();
  
  return jest.fn().mockImplementation(() => ({
    execute: mockExecute,
    get: mockGet,
    api: mockApi,
    listen: mockListen
  }));
});

describe('useSubscription Hook', () => {
  let monday;
  
  beforeEach(() => {
    monday = mondaySdk();
    jest.clearAllMocks();
  });
  
  test('should fetch subscription data on mount', async () => {
    // Mock API responses
    monday.get.mockResolvedValueOnce({ data: 'test-token' });
    monday.api.mockResolvedValueOnce({
      data: {
        subscription: {
          planId: 'basic_plan',
          isActive: true,
          isOnTrial: false
        },
        features: {
          bulkOperations: false,
          customWorkflows: false,
          advancedAnalytics: false
        },
        limits: {
          maxRequests: 100,
          usageCount: 25
        }
      }
    });
    
    // Render the hook
    const { result, waitForNextUpdate } = renderHook(() => useSubscription('account123'));
    
    // Initially, it should be in loading state
    expect(result.current.loading).toBe(true);
    expect(result.current.subscription).toBe(null);
    
    // Wait for API calls to resolve
    await waitForNextUpdate();
    
    // Verify the API was called correctly
    expect(monday.get).toHaveBeenCalledWith('sessionToken');
    expect(monday.api).toHaveBeenCalledWith(
      '/api/subscription/account123',
      expect.objectContaining({
        method: 'get',
        headers: {
          'x-monday-session-token': 'test-token'
        }
      })
    );
    
    // Check the final state
    expect(result.current.loading).toBe(false);
    expect(result.current.subscription).toEqual({
      subscription: {
        planId: 'basic_plan',
        isActive: true,
        isOnTrial: false
      },
      features: {
        bulkOperations: false,
        customWorkflows: false,
        advancedAnalytics: false
      },
      limits: {
        maxRequests: 100,
        usageCount: 25
      }
    });
  });
  
  test('should handle API errors', async () => {
    // Mock API error
    monday.get.mockResolvedValueOnce({ data: 'test-token' });
    monday.api.mockRejectedValueOnce(new Error('API Error'));
    
    // Render the hook
    const { result, waitForNextUpdate } = renderHook(() => useSubscription('account123'));
    
    // Wait for API calls to resolve
    await waitForNextUpdate();
    
    // Check for error state
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Failed to load subscription information');
  });
  
  test('should not fetch data if accountId is not provided', async () => {
    // Render the hook without accountId
    const { result } = renderHook(() => useSubscription(null));
    
    // It should immediately be in non-loading state
    expect(result.current.loading).toBe(false);
    expect(result.current.subscription).toBe(null);
    
    // API should not be called
    expect(monday.get).not.toHaveBeenCalled();
    expect(monday.api).not.toHaveBeenCalled();
  });
  
  test('should check if feature is available', async () => {
    // Setup mock subscription data
    monday.get.mockResolvedValueOnce({ data: 'test-token' });
    monday.api.mockResolvedValueOnce({
      data: {
        subscription: {
          planId: 'pro_plan',
          isActive: true
        },
        features: {
          bulkOperations: true,
          customWorkflows: true,
          advancedAnalytics: false
        },
        limits: {
          maxRequests: 500,
          usageCount: 100
        }
      }
    });
    
    // Render the hook
    const { result, waitForNextUpdate } = renderHook(() => useSubscription('account123'));
    
    // Wait for API calls to resolve
    await waitForNextUpdate();
    
    // Check feature availability
    expect(result.current.hasFeature('bulkOperations')).toBe(true);
    expect(result.current.hasFeature('customWorkflows')).toBe(true);
    expect(result.current.hasFeature('advancedAnalytics')).toBe(false);
    expect(result.current.hasFeature('nonExistentFeature')).toBe(false);
  });
  
  test('should check if subscription has reached limit', async () => {
    // Setup mock subscription data
    monday.get.mockResolvedValueOnce({ data: 'test-token' });
    monday.api.mockResolvedValueOnce({
      data: {
        subscription: {
          planId: 'basic_plan',
          isActive: true
        },
        features: {},
        limits: {
          maxRequests: 100,
          usageCount: 99 // Just below the limit
        }
      }
    });
    
    // Render the hook
    const { result, waitForNextUpdate } = renderHook(() => useSubscription('account123'));
    
    // Wait for API calls to resolve
    await waitForNextUpdate();
    
    // Check if reached limit
    expect(result.current.hasReachedLimit()).toBe(false);
    
    // Update subscription to reach the limit
    act(() => {
      result.current.subscription.limits.usageCount = 100;
    });
    
    // Now should be at the limit
    expect(result.current.hasReachedLimit()).toBe(true);
  });
  
  test('should increment usage count', async () => {
    // Setup mock subscription data
    monday.get.mockResolvedValueOnce({ data: 'test-token' });
    monday.api.mockResolvedValueOnce({
      data: {
        subscription: {
          planId: 'basic_plan',
          isActive: true
        },
        features: {},
        limits: {
          maxRequests: 100,
          usageCount: 50
        }
      }
    });
    
    // Setup mock increment API call
    monday.get.mockResolvedValueOnce({ data: 'test-token' });
    monday.api.mockResolvedValueOnce({ data: { success: true } });
    
    // Render the hook
    const { result, waitForNextUpdate } = renderHook(() => useSubscription('account123'));
    
    // Wait for initial API call to resolve
    await waitForNextUpdate();
    
    // Call incrementUsage
    let incrementResult;
    await act(async () => {
      incrementResult = await result.current.incrementUsage();
    });
    
    // Verify the API was called correctly
    expect(monday.api).toHaveBeenCalledWith(
      '/api/subscription/account123/increment',
      expect.objectContaining({
        method: 'post',
        headers: {
          'x-monday-session-token': 'test-token'
        }
      })
    );
    
    // Check the result
    expect(incrementResult).toBe(true);
    
    // Verify the local subscription was updated
    expect(result.current.subscription.limits.usageCount).toBe(51);
  });
  
  test('should format plan name correctly', async () => {
    // Setup mock subscription data
    monday.get.mockResolvedValueOnce({ data: 'test-token' });
    monday.api.mockResolvedValueOnce({
      data: {
        subscription: {
          planId: 'basic_plan',
          isActive: true
        },
        features: {},
        limits: {
          maxRequests: 100,
          usageCount: 50
        }
      }
    });
    
    // Render the hook
    const { result, waitForNextUpdate } = renderHook(() => useSubscription('account123'));
    
    // Wait for API call to resolve
    await waitForNextUpdate();
    
    // Check plan name formatting
    expect(result.current.getPlanName()).toBe('Basic Plan');
    
    // Test with other plan types
    act(() => {
      result.current.subscription.subscription.planId = 'free_trial';
    });
    expect(result.current.getPlanName()).toBe('Free Trial');
    
    act(() => {
      result.current.subscription.subscription.planId = 'enterprise_plan';
    });
    expect(result.current.getPlanName()).toBe('Enterprise Plan');
    
    act(() => {
      result.current.subscription.subscription.planId = 'custom_plan_name';
    });
    expect(result.current.getPlanName()).toBe('Custom Plan Name');
  });
  
  test('should open billing section', () => {
    // Render the hook
    const { result } = renderHook(() => useSubscription('account123'));
    
    // Call openBillingSection
    result.current.openBillingSection();
    
    // Verify monday.execute was called correctly
    expect(monday.execute).toHaveBeenCalledWith('openAppBillingSection', { isInPlanSelection: false });
    
    // Call with plan selection flag
    result.current.openBillingSection(true);
    
    // Verify called with the flag
    expect(monday.execute).toHaveBeenCalledWith('openAppBillingSection', { isInPlanSelection: true });
  });
});