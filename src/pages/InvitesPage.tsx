import { useEffect } from 'react';
import { InvitesList } from '@/features/invites/InvitesList';
import { useAuth } from '@/shared/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { signOut } from '@/shared/api/auth';

export function InvitesPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) {
            navigate('/auth/signin');
        }
    }, [user, navigate]);

    const handleSignOut = async () => {
        await signOut();
        navigate('/auth/signin');
    };

    if (!user) {
        return null;
    }

    return (
        <div className="page">
            <header className="page__header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
                    <Button variant="ghost" onClick={() => navigate('/workspaces')}>
                        ← Back
                    </Button>
                    <h1>My Invitations</h1>
                </div>
                <div className="page__header-actions">
                    <span>{user.email}</span>
                    <Button variant="ghost" onClick={handleSignOut}>Sign Out</Button>
                </div>
            </header>
            <div className="invites-page__content">
                <InvitesList />
            </div>
        </div>
    );
}