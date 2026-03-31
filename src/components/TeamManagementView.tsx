import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService, Team } from '../services/api';

const isRegionalManagerRole = (role?: string) =>
  role === 'REGIONAL_SALES_MANAGER' || role === 'REGIONAL_MANAGER';

const roleBadgeClass = (role: string) => role.toLowerCase().replace(/_/g, '-');

const displayRole = (role: string) => role.replace(/_/g, ' ');

const TeamManagementView: React.FC = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'hierarchy'>('list');
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'sales-director' | 'regional-manager' | 'sales-lead'>('all');

  const loadData = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      setError('');
      const teamsData = await apiService.getTeams();
      setTeams(teamsData);
    } catch (err) {
      setError('Failed to load team data');
      console.error('Failed to load team data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    loadData();
  }, [user?.id, loadData]);

  const getFilteredTeams = () => {
    if (activeSubTab === 'all') {
      return teams;
    }

    return teams.filter(team => {
      if (!team.manager) {
        return false;
      }

      switch (activeSubTab) {
        case 'sales-director':
          return team.manager.role === 'SALES_DIRECTOR';
        case 'regional-manager':
          return isRegionalManagerRole(team.manager.role);
        case 'sales-lead':
          return team.manager.role === 'SALES_LEAD';
        default:
          return true;
      }
    });
  };

  const getSubTabTitle = () => {
    switch (activeSubTab) {
      case 'sales-director':
        return 'Sales Director Teams';
      case 'regional-manager':
        return 'Regional Manager Teams';
      case 'sales-lead':
        return 'Sales Lead Teams';
      default:
        return 'All Teams';
    }
  };

  const filteredTeams = getFilteredTeams();

  const countByManagerRole = (check: (role?: string) => boolean) =>
    teams.filter(t => t.manager && check(t.manager!.role)).length;

  const membersExcludingManager = (team: Team) => {
    const mgrId = team.manager?.id;
    const members = Array.isArray(team.members) ? team.members : [];
    if (!mgrId) {
      return members;
    }
    return members.filter(m => m.id !== mgrId);
  };

  if (isLoading) {
    return (
      <div className="team-members tm-panel">
        <div className="loading">Loading team data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="team-members tm-panel">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="team-members tm-panel">
      <div className="section-header">
        <h3>🏢 Team Management</h3>
        <div className="header-actions">
          <div className="view-mode-toggle">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`view-toggle ${viewMode === 'list' ? 'active' : ''}`}
            >
              📋 List View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('hierarchy')}
              className={`view-toggle ${viewMode === 'hierarchy' ? 'active' : ''}`}
            >
              🏗️ Hierarchy View
            </button>
          </div>
          <button type="button" onClick={() => { setIsLoading(true); loadData(); }} className="refresh-button">
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="sub-tabs">
        <button
          type="button"
          className={`sub-tab ${activeSubTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('all')}
        >
          📊 All Teams ({teams.length})
        </button>
        <button
          type="button"
          className={`sub-tab ${activeSubTab === 'sales-director' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('sales-director')}
        >
          👔 Sales Director Teams ({countByManagerRole(r => r === 'SALES_DIRECTOR')})
        </button>
        <button
          type="button"
          className={`sub-tab ${activeSubTab === 'regional-manager' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('regional-manager')}
        >
          🏢 Regional Manager Teams ({countByManagerRole(r => isRegionalManagerRole(r))})
        </button>
        <button
          type="button"
          className={`sub-tab ${activeSubTab === 'sales-lead' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('sales-lead')}
        >
          👥 Sales Lead Teams ({countByManagerRole(r => r === 'SALES_LEAD')})
        </button>
      </div>

      {viewMode === 'hierarchy' ? (
        <div className="hierarchical-view">
          {filteredTeams.length === 0 ? (
            <p className="tm-empty-hint">
              No teams found in {getSubTabTitle().toLowerCase()}.
            </p>
          ) : (
            filteredTeams.map(team => (
              <div key={team.id} className="team-hierarchy">
                <h4>🏢 {team.name}</h4>
                {team.manager ? (
                  <div className="manager-card">
                    <div className="manager-info">
                      <div className="manager-avatar">
                        {team.manager.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="manager-details">
                        <h5>{team.manager.displayName}</h5>
                        <p>{team.manager.email}</p>
                        <span className={`role-badge ${roleBadgeClass(team.manager.role)}`}>
                          {displayRole(team.manager.role)}
                        </span>
                      </div>
                    </div>
                    <div className="subordinates">
                      {membersExcludingManager(team).map(member => (
                        <div key={member.id} className="subordinate-card">
                          <div className="subordinate-info">
                            <div className="subordinate-avatar">
                              {member.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="subordinate-details">
                              <h6>{member.displayName}</h6>
                              <p>{member.email}</p>
                              <span className={`role-badge ${roleBadgeClass(member.role)}`}>
                                {displayRole(member.role)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="no-manager">
                    <p>No manager assigned to this team.</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : filteredTeams.length === 0 ? (
        <p className="tm-empty-hint">
          No teams found in {getSubTabTitle().toLowerCase()}.
        </p>
      ) : (
        filteredTeams.map(team => (
          <div key={team.id} className="team-section">
            <div className="tm-team-block-header">
              <div className="team-info">
                <h4>
                  🏢 {team.name} ({team.region?.name || 'No region'})
                </h4>
                <p className="team-manager-line">
                  👤 Manager:{' '}
                  {team.manager
                    ? `${team.manager.displayName} (${displayRole(team.manager.role)})`
                    : 'No manager assigned'}
                </p>
              </div>
            </div>

            {!team.members || team.members.length === 0 ? (
              <p className="no-members">No members assigned to this team.</p>
            ) : (
              <ul className="team-members-list">
                {team.members.map(m => (
                  <li key={m.id} className="team-member">
                    <span className="member-info">
                      👤 {m.displayName} ({m.email}) — {displayRole(m.role)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default TeamManagementView;
