import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { apiService, Team } from '../services/api';
import { useTranslation } from 'react-i18next';

const MyTeam: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const lastUserIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Only load if user ID actually changed
    if (!user?.id || user.id === lastUserIdRef.current) {
      if (!user?.id) {
        setIsLoading(false);
      }
      return;
    }
    
    lastUserIdRef.current = user.id;
    
    const loadTeam = async () => {
      try {
        const teamData = await apiService.getMyTeam();
        
        if (teamData && teamData.members && teamData.members.length > 0) {
          setTeam(teamData);
        } else {
          setTeam(null);
        }
      } catch (err) {
        console.error('Failed to load team:', err);
        setError(t('team.failedToLoadTeamData'));
      } finally {
        setIsLoading(false);
      }
    };

    loadTeam();
  }, [user?.id, t]);

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'SALES_DIRECTOR': return t('team.salesDirector');
      case 'REGIONAL_SALES_MANAGER': return t('team.regionalManager');
      case 'SALES_LEAD': return t('team.salesLead');
      case 'SALESPERSON': return t('team.salesperson');
      case 'ADMIN': return t('team.administrator');
      default: return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'SALES_DIRECTOR': return '🏢';
      case 'REGIONAL_SALES_MANAGER': return '🏢';
      case 'SALES_LEAD': return '👨‍💼';
      case 'SALESPERSON': return '👤';
      case 'ADMIN': return '⚙️';
      default: return '👤';
    }
  };

  if (isLoading) {
    return (
      <div className="my-team">
        <div className="loading">{t('team.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-team">
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="my-team">
        <div className="no-teams">
          <h3>{t('team.noTeam')}</h3>
          <p>{t('team.noTeamDescription')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-team">
      <div className="team-header">
        <h2>{t('team.myTeam')}</h2>
        <div className="team-info">
          <h3>{team.name}</h3>
          {team.region && (
            <p className="team-region">📍 {team.region.name}</p>
          )}
        </div>
      </div>

      <div className="team-members">
        <h4>{t('team.teamMembers')} ({team.members.length})</h4>
        <div className="team-members-grid">
          {team.members.map((member) => (
            <div key={member.id} className="team-member-card">
              <div className="member-avatar">
                {getRoleIcon(member.role)}
              </div>
              <div className="member-details">
                <div className="member-name">{member.displayName}</div>
                <div className="member-role">{getRoleDisplayName(member.role)}</div>
                <div className="member-email">{member.email}</div>
                {member.id === user?.id && (
                  <div className="member-badge">{t('common.you')}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {team.manager && (
        <div className="team-manager">
          <h4>{t('team.teamManager')}</h4>
          <div className="manager-card">
            <div className="member-avatar">
              {getRoleIcon(team.manager.role)}
            </div>
            <div className="member-details">
              <div className="member-name">{team.manager.displayName}</div>
              <div className="member-role">{getRoleDisplayName(team.manager.role)}</div>
              <div className="member-email">{team.manager.email}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTeam;
