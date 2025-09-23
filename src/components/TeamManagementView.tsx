import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService, User, Team } from '../services/api';

const TeamManagementView: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [teamsData, usersData] = await Promise.all([
          apiService.getTeams(),
          apiService.getUsers()
        ]);
        setTeams(teamsData);
        setAllUsers(usersData);
      } catch (err) {
        setError('Failed to load team data');
        console.error('Failed to load team data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const getUsersByRole = (role: string) => {
    return allUsers.filter(user => user.role === role);
  };

  const getTeamHierarchy = () => {
    const hierarchy = {
      salesDirectors: getUsersByRole('SALES_DIRECTOR'),
      regionalManagers: getUsersByRole('REGIONAL_SALES_MANAGER'),
      salesLeads: getUsersByRole('SALES_LEAD'),
      salespeople: getUsersByRole('SALESPERSON')
    };
    return hierarchy;
  };

  if (isLoading) {
    return (
      <div className="team-management">
        <div className="loading">Loading team data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="team-management">
        <div className="error">{error}</div>
      </div>
    );
  }

  const hierarchy = getTeamHierarchy();

  return (
    <div className="team-management">
      <div className="team-header">
        <h2>Team Management</h2>
        <p>View and manage your organizational hierarchy</p>
      </div>

      <div className="hierarchy-view">
        <div className="hierarchy-level">
          <h3>Sales Directors</h3>
          <div className="users-grid">
            {hierarchy.salesDirectors.map(director => (
              <div key={director.id} className="user-card director">
                <div className="user-avatar">👔</div>
                <div className="user-info">
                  <div className="user-name">{director.displayName}</div>
                  <div className="user-email">{director.email}</div>
                  <div className="user-role">Sales Director</div>
                </div>
              </div>
            ))}
            {hierarchy.salesDirectors.length === 0 && (
              <div className="no-users">No Sales Directors found</div>
            )}
          </div>
        </div>

        <div className="hierarchy-level">
          <h3>Regional Managers</h3>
          <div className="users-grid">
            {hierarchy.regionalManagers.map(manager => (
              <div key={manager.id} className="user-card manager">
                <div className="user-avatar">👨‍💼</div>
                <div className="user-info">
                  <div className="user-name">{manager.displayName}</div>
                  <div className="user-email">{manager.email}</div>
                  <div className="user-role">Regional Manager</div>
                </div>
              </div>
            ))}
            {hierarchy.regionalManagers.length === 0 && (
              <div className="no-users">No Regional Managers found</div>
            )}
          </div>
        </div>

        <div className="hierarchy-level">
          <h3>Sales Leads</h3>
          <div className="users-grid">
            {hierarchy.salesLeads.map(lead => (
              <div key={lead.id} className="user-card lead">
                <div className="user-avatar">👨‍💻</div>
                <div className="user-info">
                  <div className="user-name">{lead.displayName}</div>
                  <div className="user-email">{lead.email}</div>
                  <div className="user-role">Sales Lead</div>
                </div>
              </div>
            ))}
            {hierarchy.salesLeads.length === 0 && (
              <div className="no-users">No Sales Leads found</div>
            )}
          </div>
        </div>

        <div className="hierarchy-level">
          <h3>Salespeople</h3>
          <div className="users-grid">
            {hierarchy.salespeople.map(salesperson => (
              <div key={salesperson.id} className="user-card salesperson">
                <div className="user-avatar">👤</div>
                <div className="user-info">
                  <div className="user-name">{salesperson.displayName}</div>
                  <div className="user-email">{salesperson.email}</div>
                  <div className="user-role">Salesperson</div>
                </div>
              </div>
            ))}
            {hierarchy.salespeople.length === 0 && (
              <div className="no-users">No Salespeople found</div>
            )}
          </div>
        </div>
      </div>

      <div className="teams-section">
        <h3>Teams</h3>
        <div className="teams-grid">
          {teams.map(team => (
            <div key={team.id} className="team-card">
              <div className="team-header">
                <h4>{team.name}</h4>
                {team.region && (
                  <span className="team-region">{team.region.name}</span>
                )}
              </div>
              <div className="team-members">
                <div className="members-count">
                  {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                </div>
                <div className="members-list">
                  {team.members.slice(0, 3).map(member => (
                    <div key={member.id} className="member-item">
                      <span className="member-name">{member.displayName}</span>
                      <span className="member-role">{member.role}</span>
                    </div>
                  ))}
                  {team.members.length > 3 && (
                    <div className="more-members">
                      +{team.members.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {teams.length === 0 && (
            <div className="no-teams">No teams found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamManagementView;
