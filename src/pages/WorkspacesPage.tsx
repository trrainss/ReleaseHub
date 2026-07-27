import { useState } from 'react';
import { Link } from 'react-router-dom';
import { WorkspaceList } from '@/features/workspaces/WorkspaceList';
import { CreateWorkspaceForm } from '@/features/workspaces/CreateWorkspaceForm';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { signOut } from '@/shared/api/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';

export function WorkspacesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/signin');
  };

  return (
    <div className="page">
      <header className="page__header">
        <h1>Workspaces</h1>
        <div className="page__header-actions">
          <Link to="/invites" className="back-link" style={{ marginRight: 0 }}>
             Invitations
          </Link>
          <span>{profile?.display_name}</span>
          <Button onClick={() => setShowCreate(true)}>New Workspace</Button>
          <Button variant="ghost" onClick={handleSignOut}>Sign Out</Button>
        </div>
      </header>
      <WorkspaceList />
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Workspace">
        <CreateWorkspaceForm onSuccess={() => setShowCreate(false)} />
      </Modal>
    </div>
  );
}