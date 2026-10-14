import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui';
import './PageHeader.css';

/**
 * Title bar inside the app shell: optional back link, title (+ subtitle) and page actions.
 * Navigation to Home and the theme switch live in the shell, so a back link only appears for
 * pages that sit below another page (`backTo` other than '/').
 */
export default function PageHeader({
  title,
  subtitle,
  backTo = '/',
  backLabel = 'Back',
  actions,
  icon,
}) {
  const navigate = useNavigate();
  const showBack = Boolean(backTo) && backTo !== '/';

  return (
    <header className="page-header">
      <div className="page-header-inner">
        {showBack && (
          <Button variant="ghost" size="sm" icon="arrowLeft" className="page-header-back" onClick={() => navigate(backTo)}>
            {backLabel}
          </Button>
        )}
        <div className="page-header-titles">
          <h1 className="page-header-title">
            {icon && <span className="page-header-icon" aria-hidden="true">{icon}</span>}
            <span className="page-header-text">{title}</span>
          </h1>
          {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </header>
  );
}
