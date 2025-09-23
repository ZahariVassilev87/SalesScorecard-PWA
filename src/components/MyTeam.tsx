import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService, Team } from '../services/api';

const MyTeam: React.FC = () => {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTeam = async () => {
      try {
        const teamData = await apiService.getMyTeam();
        setTeam(teamData);
      } catch (err) {
        setError('Failed to load team data');
        console.error('Failed to load team:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTeam();
  }, []);

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'REGIONAL_MANAGER': return 'Regional Manager';
      case 'SALES_LEAD': return 'Sales Lead';
      case 'SALESPERSON': return 'Salesperson';
      case 'ADMIN': return 'Administrator';
      default: return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'REGIONAL_MANAGER': return '🏢';
      case 'SALES_LEAD': return '👨‍💼';
      case 'SALESPERSON': return '👤';
      case 'ADMIN': return '⚙️';
      default: return '👤';
    }
  };

  if (isLoading) {
    return (
      <div className="my-team">
        <div className="loading">Loading team...</div>
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
          <h3>No Team Found</h3>
          <p>You are not currently assigned to any team.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-team">
      <div className="team-header">
        <h2>My Team</h2>
        <div className="team-info">
          <h3>{team.name}</h3>
          {team.region && (
            <p className="team-region">📍 {team.region.name}</p>
          )}
        </div>
      </div>

      <div className="team-members">
        <h4>Team Members ({team.members.length})</h4>
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
                  <div className="member-badge">You</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {team.manager && (
        <div className="team-manager">
          <h4>Team Manager</h4>
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
