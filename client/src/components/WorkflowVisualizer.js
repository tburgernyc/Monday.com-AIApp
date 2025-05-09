import React, { useState, useEffect } from 'react';
import './WorkflowVisualizer.css';

/**
 * Renders a visual representation of a workflow
 * 
 * @param {Object} props - Component props
 * @param {Object} props.workflow - Workflow configuration
 * @param {Function} props.onEdit - Callback when editing a workflow element
 */
function WorkflowVisualizer({ workflow, onEdit }) {
  const [boards, setBoards] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [connections, setConnections] = useState([]);
  const [boardRefs, setBoardRefs] = useState({});
  
  // Process workflow data when it changes
  useEffect(() => {
    if (!workflow) return;
    
    // Extract components from workflow
    const extractedBoards = workflow.boards || [];
    const extractedAutomations = [];
    const boardConnections = [];
    
    // Create refs object for boards
    const refs = {};
    extractedBoards.forEach(board => {
      refs[board.id || board.name] = React.createRef();
    });
    setBoardRefs(refs);
    
    // Extract automations and connections from all boards
    extractedBoards.forEach(board => {
      if (board.automations) {
        board.automations.forEach(automation => {
          extractedAutomations.push({
            ...automation,
            boardId: board.id || board.name
          });
          
          // Check for cross-board connections
          if (automation.actions) {
            automation.actions.forEach(action => {
              if (action.config && action.config.boardId && action.config.boardId !== board.id) {
                boardConnections.push({
                  from: board.id || board.name,
                  to: action.config.boardId,
                  type: action.type
                });
              }
            });
          }
        });
      }
    });
    
    setBoards(extractedBoards);
    setAutomations(extractedAutomations);
    setConnections(boardConnections);
    
  }, [workflow]);
  
  // Calculate connection lines between boards
  const renderConnections = () => {
    if (!boardRefs || Object.keys(boardRefs).length === 0) return null;
    
    return connections.map((connection, index) => {
      const fromRef = boardRefs[connection.from];
      const toRef = boardRefs[connection.to];
      
      if (!fromRef || !fromRef.current || !toRef || !toRef.current) return null;
      
      const fromRect = fromRef.current.getBoundingClientRect();
      const toRect = toRef.current.getBoundingClientRect();
      
      const svgRect = document.querySelector('.connections-svg').getBoundingClientRect();
      
      const x1 = fromRect.left + fromRect.width / 2 - svgRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - svgRect.top;
      const x2 = toRect.left + toRect.width / 2 - svgRect.left;
      const y2 = toRect.top + toRect.height / 2 - svgRect.top;
      
      return (
        <g key={`connection-${index}`}>
          <line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#0073ea"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          <text 
            x={(x1 + x2) / 2} 
            y={(y1 + y2) / 2} 
            fill="#676879"
            fontSize="12"
            textAnchor="middle"
            dominantBaseline="middle"
            background="#ffffff"
          >
            <tspan dx="0" dy="0" className="connection-label">{connection.type}</tspan>
          </text>
        </g>
      );
    });
  };
  
  // Render the workflow diagram
  return (
    <div className="workflow-visualizer">
      <h3>Workflow Diagram</h3>
      
      <div className="workflow-canvas">
        {/* Render boards */}
        <div className="boards-container">
          {boards.map((board, index) => (
            <div 
              key={board.id || `board-${index}`}
              ref={boardRefs[board.id || board.name]}
              className="board-box"
              onClick={() => onEdit && onEdit('board', board)}
            >
              <h4>{board.name}</h4>
              <div className="board-columns">
                {(board.columns || []).slice(0, 3).map((column, colIndex) => (
                  <div key={column.id || `col-${colIndex}`} className="column-tag">
                    {column.title}
                  </div>
                ))}
                {(board.columns || []).length > 3 && (
                  <div className="column-tag more-columns">
                    +{board.columns.length - 3} more
                  </div>
                )}
              </div>
              <div className="board-groups">
                {(board.groups || []).slice(0, 2).map((group, groupIndex) => (
                  <div key={group.id || `group-${groupIndex}`} className="group-tag">
                    {group.title}
                  </div>
                ))}
                {(board.groups || []).length > 2 && (
                  <div className="group-tag more-groups">
                    +{board.groups.length - 2} more
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Render automations */}
        <div className="automations-container">
          {automations.map((automation, index) => (
            <div 
              key={`automation-${index}`}
              className="automation-box"
              onClick={() => onEdit && onEdit('automation', automation)}
            >
              <div className="automation-header">
                <div className="automation-name">
                  {automation.name || `Automation ${index + 1}`}
                </div>
                <div className="automation-board">
                  {boards.find(b => b.id === automation.boardId || b.name === automation.boardId)?.name || automation.boardId}
                </div>
              </div>
              <div className="automation-trigger">
                <span className="trigger-label">Trigger:</span> {automation.trigger.type}
              </div>
              <div className="automation-actions">
                <span className="actions-label">Actions:</span>
                {(automation.actions || []).map((action, actIndex) => (
                  <div key={`action-${actIndex}`} className="action-tag">
                    {action.type}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* Render connections as SVG lines */}
        <svg className="connections-svg">
          {renderConnections()}
        </svg>
      </div>
      
      <div className="workflow-legend">
        <div className="legend-item">
          <div className="legend-color board-color"></div>
          <span>Board</span>
        </div>
        <div className="legend-item">
          <div className="legend-color automation-color"></div>
          <span>Automation</span>
        </div>
        <div className="legend-item">
          <div className="legend-color connection-color"></div>
          <span>Cross-Board Connection</span>
        </div>
      </div>
    </div>
  );
}

export default WorkflowVisualizer;