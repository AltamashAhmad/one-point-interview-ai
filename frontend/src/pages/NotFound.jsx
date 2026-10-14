import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState } from '../components/ui';
import PageHeader from '../components/PageHeader';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="page-shell">
      <PageHeader title="Page not found" />
      <EmptyState
        icon="search"
        headingAs="h2"
        title="We couldn't find that page"
        description="The link may be outdated, or the page may have moved."
        action={<Button onClick={() => navigate('/')}>Go to home</Button>}
      />
    </div>
  );
}
