import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConversationHistory from '../ConversationHistory';

describe('ConversationHistory Component', () => {
  // Mock data for testing
  const mockHistory = [
    {
      id: 'conv1',
      prompt: 'Create a new board called Project X',
      explanation: 'I created a new board named "Project X" for you.',
      timestamp: '2025-05-01T14:30:00.000Z'
    },
    {
      id: 'conv2',
      prompt: 'Show all my tasks with status Done',
      explanation: 'Here are all the tasks marked as Done.',
      timestamp: '2025-05-01T10:15:00.000Z'
    }
  ];
  
  // Mock functions
  const mockOnSelectConversation = jest.fn();
  const mockOnClearHistory = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders loading state correctly', () => {
    render(
      <ConversationHistory
        loading={true}
        history={[]}
        onSelectConversation={mockOnSelectConversation}
        onClearHistory={mockOnClearHistory}
      />
    );
    
    expect(screen.getByText('Loading conversation history...')).toBeInTheDocument();
    expect(screen.getByText('Conversation History')).toBeInTheDocument();
  });
  
  test('renders empty state correctly', () => {
    render(
      <ConversationHistory
        loading={false}
        history={[]}
        onSelectConversation={mockOnSelectConversation}
        onClearHistory={mockOnClearHistory}
      />
    );
    
    expect(screen.getByText('No previous conversations found.')).toBeInTheDocument();
  });
  
  test('renders history items correctly', () => {
    render(
      <ConversationHistory
        loading={false}
        history={mockHistory}
        onSelectConversation={mockOnSelectConversation}
        onClearHistory={mockOnClearHistory}
      />
    );
    
    // Check that both history items are rendered
    expect(screen.getByText('Create a new board called Project X')).toBeInTheDocument();
    expect(screen.getByText('Show all my tasks with status Done')).toBeInTheDocument();
    
    // Check that timestamps are formatted correctly
    const timestamps = screen.getAllByText(/\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} (AM|PM)/);
    expect(timestamps.length).toBe(2);
  });
  
  test('expands item details when clicked', () => {
    render(
      <ConversationHistory
        loading={false}
        history={mockHistory}
        onSelectConversation={mockOnSelectConversation}
        onClearHistory={mockOnClearHistory}
      />
    );
    
    // Initially, explanation should not be visible
    expect(screen.queryByText('I created a new board named "Project X" for you.')).not.toBeInTheDocument();
    
    // Click the first history item
    fireEvent.click(screen.getByText('Create a new board called Project X'));
    
    // Now explanation should be visible
    expect(screen.getByText('I created a new board named "Project X" for you.')).toBeInTheDocument();
    expect(screen.getByText('Continue from this conversation')).toBeInTheDocument();
  });
  
  test('calls onSelectConversation when continue button is clicked', () => {
    render(
      <ConversationHistory
        loading={false}
        history={mockHistory}
        onSelectConversation={mockOnSelectConversation}
        onClearHistory={mockOnClearHistory}
      />
    );
    
    // Click the first history item to expand it
    fireEvent.click(screen.getByText('Create a new board called Project X'));
    
    // Click the continue button
    fireEvent.click(screen.getByText('Continue from this conversation'));
    
    // Verify onSelectConversation was called with the correct item
    expect(mockOnSelectConversation).toHaveBeenCalledWith(mockHistory[0]);
  });
  
  test('filters history by search query', () => {
    render(
      <ConversationHistory
        loading={false}
        history={mockHistory}
        onSelectConversation={mockOnSelectConversation}
        onClearHistory={mockOnClearHistory}
      />
    );
    
    // Initially, both items should be visible
    expect(screen.getByText('Create a new board called Project X')).toBeInTheDocument();
    expect(screen.getByText('Show all my tasks with status Done')).toBeInTheDocument();
    
    // Type in the search input
    const searchInput = screen.getByPlaceholderText('Search history...');
    fireEvent.change(searchInput, { target: { value: 'board' } });
    
    // Now only the first item should be visible
    expect(screen.getByText('Create a new board called Project X')).toBeInTheDocument();
    expect(screen.queryByText('Show all my tasks with status Done')).not.toBeInTheDocument();
  });
  
  test('shows empty message when search has no results', () => {
    render(
      <ConversationHistory
        loading={false}
        history={mockHistory}
        onSelectConversation={mockOnSelectConversation}
        onClearHistory={mockOnClearHistory}
      />
    );
    
    // Type a search query with no matches
    const searchInput = screen.getByPlaceholderText('Search history...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    // Check that the no results message is shown
    expect(screen.getByText('No conversations match your search.')).toBeInTheDocument();
  });
  
  test('confirms before clearing history', async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn().mockReturnValue(true); // Simulate user clicking "Yes"
    
    render(
      <ConversationHistory
        loading={false}
        history={mockHistory}
        onSelectConversation={mockOnSelectConversation}
        onClearHistory={mockOnClearHistory}
      />
    );
    
    // Click the clear all button
    fireEvent.click(screen.getByText('Clear All'));
    
    // Verify confirmation dialog was shown
    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to clear your conversation history?');
    
    // Verify onClearHistory was called
    expect(mockOnClearHistory).toHaveBeenCalled();
    
    // Restore original window.confirm
    window.confirm = originalConfirm;
  });
  
  test('does not clear history if confirmation is cancelled', () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn().mockReturnValue(false); // Simulate user clicking "No"
    
    render(
      <ConversationHistory
        loading={false}
        history={mockHistory}
        onSelectConversation={mockOnSelectConversation}
        onClearHistory={mockOnClearHistory}
      />
    );
    
    // Click the clear all button
    fireEvent.click(screen.getByText('Clear All'));
    
    // Verify confirmation dialog was shown
    expect(window.confirm).toHaveBeenCalled();
    
    // Verify onClearHistory was NOT called
    expect(mockOnClearHistory).not.toHaveBeenCalled();
    
    // Restore original window.confirm
    window.confirm = originalConfirm;
  });
});