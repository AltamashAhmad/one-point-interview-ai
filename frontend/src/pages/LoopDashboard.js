import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLoopPersist } from '../hooks/useLoopPersist';
import { TYPE_CONFIG } from '../utils/constants';
import ThemeToggle from '../components/ThemeToggle';
import './LoopDashboard.css';

export default function LoopDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getLoop } = useLoopPersist();
  const [loop, setLoop] = useState(null);

  useEffect(() => {
    let active = true;
    getLoop(id)
      .then((data) => {
        if (!active) return;
        if (!data) {
          navigate('/', { replace: true });
        } else {
          setLoop(data);
        }
      })
      .catch(() => {
        if (active) navigate('/', { replace: true });
      });
    return () => { active = false; };
  }, [id, getLoop, navigate]);

  if (!loop) return null;

  return (
    <div className="loop-dashboard-container">
      <div className="loop-dashboard-content">
        
        <div className="top-bar-nav">
          <button className="back-btn" onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/')}>
            ← Back to Home
          </button>
          <ThemeToggle />
        </div>

        <div className="loop-header">
          <h1>
            {loop.company} 
            <span className="loop-level">{loop.level}</span>
          </h1>
          <div className={`loop-status ${loop.status}`}>
            Status: {loop.status.replace('-', ' ')}
          </div>
        </div>

        <div className="loop-timeline">
          <div className="loop-timeline-line"></div>
          {loop.rounds.map((round, index) => {
            const config = TYPE_CONFIG[round.type] || { label: round.type, emoji: '📄', color: '#64748b', glow: 'rgba(100,116,139,0.1)' };
            const isCurrent = index === loop.currentRoundIndex && loop.status === 'in-progress';
            let roundStateClass = round.status; 
            if (index > loop.currentRoundIndex) roundStateClass = 'locked';
            
            return (
              <div key={index} className={`loop-round ${isCurrent ? 'active' : ''} ${roundStateClass}`}>
                <div className="loop-round-dot"></div>
                <div className="loop-round-header">
                  <div className="loop-round-info">
                    <div className="round-index">Round {index + 1}</div>
                    <div className="round-name">
                      {config.emoji} {round.name}
                    </div>
                  </div>
                  <div className="round-status-badge-container">
                     <span className={`round-status-badge ${roundStateClass}`}>
                       {roundStateClass}
                     </span>
                  </div>
                </div>
                
                <div className="round-details">
                  <span 
                    className="round-type-badge" 
                    style={{ background: config.glow, color: config.color }}
                  >
                    {config.label}
                  </span>
                </div>

                <div className="round-actions">
                  {isCurrent && (
                    <button 
                      className="btn btn-primary"
                      onClick={() => navigate(`/interview/${round.type}?loopId=${loop.id}&roundIndex=${index}`)}
                    >
                      Start Round →
                    </button>
                  )}
                  {round.sessionId && (
                    <button 
                      className="btn btn-outline"
                      onClick={() => navigate(`/scorecard/${round.sessionId}?loopId=${loop.id}`)}
                    >
                      View Scorecard
                    </button>
                  )}
                  {round.score !== null && (
                    <span className="round-score">
                      Score: {round.score} / 10
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
