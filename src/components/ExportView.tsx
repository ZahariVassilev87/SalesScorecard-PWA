import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService, User, Evaluation } from '../services/api';

interface ExportOptions {
  scope: 'company' | 'regional-manager' | 'sales-lead' | 'individual';
  selectedRegionalManager?: string;
  selectedSalesLead?: string;
  selectedSalesperson?: string;
  dataType: 'coaching' | 'behavior' | 'both' | 'analytics';
  timePeriod: 'month' | 'quarter' | 'custom' | 'all' | string; // string for dynamic months
  startDate?: string;
  endDate?: string;
  format: 'csv' | 'excel' | 'pdf';
}

const ExportView: React.FC = () => {
  const { user } = useAuth();

  // Generate dynamic month options based on current date going backwards
  const getAvailableMonths = () => {
    const months = [];
    const now = new Date();
    
    // Add months going backwards from current month
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleString('default', { month: 'long' });
      const year = date.getFullYear();
      const value = monthName.toLowerCase();
      
      months.push({
        value: value,
        label: `${monthName} ${year}`,
        year: year,
        monthIndex: date.getMonth()
      });
    }
    
    return months;
  };
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    scope: 'company',
    dataType: 'both',
    timePeriod: 'quarter', // Changed to quarter (last 3 months) for better default
    format: 'csv'
  });
  
  const [regionalManagers, setRegionalManagers] = useState<User[]>([]);
  const [salesLeads, setSalesLeads] = useState<User[]>([]);
  const [salespeople, setSalespeople] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMonthOptions, setShowMonthOptions] = useState(false);

  useEffect(() => {
    loadUserData();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set default scope based on user role
  useEffect(() => {
    if (user?.role) {
      if (user.role === 'SALES_DIRECTOR') {
        setExportOptions(prev => ({ ...prev, scope: 'company' }));
      } else if (user.role === 'REGIONAL_MANAGER' || user.role === 'REGIONAL_SALES_MANAGER') {
        setExportOptions(prev => ({ ...prev, scope: 'regional-manager' }));
      } else if (user.role === 'SALES_LEAD') {
        setExportOptions(prev => ({ ...prev, scope: 'sales-lead' }));
      }
    }
  }, [user?.role]);

  const loadUserData = async () => {
    try {
      console.log('🔍 Export: Loading user data for role:', user?.role);
      
      if (user?.role === 'SALES_DIRECTOR') {
        // Load all users for company-wide export
        const users = await apiService.getUsers();
        console.log('🔍 Export: Loaded users:', users.length);
        setRegionalManagers(users.filter(u => u.role === 'REGIONAL_MANAGER' || u.role === 'REGIONAL_SALES_MANAGER'));
        setSalesLeads(users.filter(u => u.role === 'SALES_LEAD'));
        setSalespeople(users.filter(u => u.role === 'SALESPERSON'));
      } else if (user?.role === 'REGIONAL_MANAGER' || user?.role === 'REGIONAL_SALES_MANAGER') {
        // Load team data for regional manager
        const team = await apiService.getMyTeam();
        console.log('🔍 Export: Loaded team for RM:', team);
        if (team) {
          const salesLeads = team.members.filter(m => m.role === 'SALES_LEAD');
          const salespeople = team.members.filter(m => m.role === 'SALESPERSON');
          console.log('🔍 Export: Sales Leads:', salesLeads);
          console.log('🔍 Export: Salespeople:', salespeople);
          setSalesLeads(salesLeads);
          setSalespeople(salespeople);
        } else {
          console.log('⚠️ Export: No team found for Regional Manager');
          setSalesLeads([]);
          setSalespeople([]);
        }
      } else if (user?.role === 'SALES_LEAD') {
        // Load team data for sales lead
        const team = await apiService.getMyTeam();
        console.log('🔍 Export: Loaded team for Sales Lead:', team);
        if (team) {
          const salespeople = team.members.filter(m => m.role === 'SALESPERSON');
          console.log('🔍 Export: Salespeople in Sales Lead team:', salespeople);
          setSalespeople(salespeople);
        } else {
          console.log('⚠️ Export: No team found for Sales Lead');
          setSalespeople([]);
        }
      }
    } catch (err) {
      console.error('❌ Export: Failed to load user data:', err);
      setError('Failed to load user data');
    }
  };

  const handleScopeChange = (scope: ExportOptions['scope']) => {
    setExportOptions(prev => ({
      ...prev,
      scope,
      selectedRegionalManager: undefined,
      selectedSalesLead: undefined,
      selectedSalesperson: undefined
    }));
  };

  const handleSpecificMonthClick = () => {
    setShowMonthOptions(!showMonthOptions);
    if (!showMonthOptions) {
      // If opening month options, don't change the timePeriod yet
    }
  };

  const handleMonthSelection = (monthValue: string) => {
    setExportOptions(prev => ({ ...prev, timePeriod: monthValue }));
    setShowMonthOptions(false); // Close the month options after selection
  };

  const handleExport = async () => {
    setIsLoading(true);
    setError('');

    try {
      console.log('🔍 Export: Starting export with options:', exportOptions);
      
      // Get filtered evaluations based on export options
      const evaluations = await apiService.getMyEvaluations();
      console.log('🔍 Export: Loaded evaluations:', evaluations.length);
      
      // Debug: Show some sample evaluation dates
      if (evaluations.length > 0) {
        console.log('🔍 Export: Sample evaluation dates:', 
          evaluations.slice(0, 5).map(e => e.visitDate).sort()
        );
      } else {
        console.log('⚠️ Export: No evaluations found at all');
      }
      
      // Apply date filtering
      const filteredEvaluations = filterEvaluationsByDate(evaluations);
      console.log('🔍 Export: After date filtering:', filteredEvaluations.length);
      
      // Apply scope filtering
      const scopeFilteredEvaluations = filterEvaluationsByScope(filteredEvaluations);
      console.log('🔍 Export: After scope filtering:', scopeFilteredEvaluations.length);
      
      // Apply data type filtering
      const finalEvaluations = filterEvaluationsByDataType(scopeFilteredEvaluations);
      console.log('🔍 Export: Final evaluations to export:', finalEvaluations.length);
      
      if (finalEvaluations.length === 0) {
        console.log('⚠️ Export: No data found with current filters');
        setError('No data found for the selected period. Please adjust your filters or select a different time period.');
        return;
      }
      
      // Export based on format
      switch (exportOptions.format) {
        case 'csv':
          exportToCSV(finalEvaluations);
          break;
        case 'excel':
          exportToExcel(finalEvaluations);
          break;
        case 'pdf':
          exportToPDF(finalEvaluations);
          break;
      }
    } catch (err) {
      setError('Export failed. Please try again.');
      console.error('Export error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filterEvaluationsByDate = (evaluations: Evaluation[]): Evaluation[] => {
    console.log('🔍 Export: Filtering by date period:', exportOptions.timePeriod);
    
    if (exportOptions.timePeriod === 'custom' && exportOptions.startDate && exportOptions.endDate) {
      console.log('🔍 Export: Custom date range:', exportOptions.startDate, 'to', exportOptions.endDate);
      return evaluations.filter(evaluation => {
        const evalDate = new Date(evaluation.visitDate + 'T00:00:00'); // Add time to avoid timezone issues
        const startDate = new Date(exportOptions.startDate! + 'T00:00:00');
        const endDate = new Date(exportOptions.endDate! + 'T23:59:59');
        const isInRange = evalDate >= startDate && evalDate <= endDate;
        console.log(`🔍 Export: Evaluation ${evaluation.visitDate} in range: ${isInRange}`);
        return isInRange;
      });
    } else if (exportOptions.timePeriod === 'month') {
      // Last month (previous month, not current month)
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
      console.log('🔍 Export: Last month range:', lastMonth.toISOString(), 'to', lastMonthEnd.toISOString());
      
      return evaluations.filter(evaluation => {
        const evalDate = new Date(evaluation.visitDate + 'T00:00:00');
        const isInLastMonth = evalDate >= lastMonth && evalDate <= lastMonthEnd;
        console.log(`🔍 Export: Evaluation ${evaluation.visitDate} in last month: ${isInLastMonth}`);
        return isInLastMonth;
      });
    } else if (exportOptions.timePeriod === 'quarter') {
      // Last 3 months (not current quarter)
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // End of previous month
      console.log('🔍 Export: Last 3 months range:', threeMonthsAgo.toISOString(), 'to', lastMonthEnd.toISOString());
      
      return evaluations.filter(evaluation => {
        const evalDate = new Date(evaluation.visitDate + 'T00:00:00');
        const isInLastThreeMonths = evalDate >= threeMonthsAgo && evalDate <= lastMonthEnd;
        console.log(`🔍 Export: Evaluation ${evaluation.visitDate} in last 3 months: ${isInLastThreeMonths}`);
        return isInLastThreeMonths;
      });
    } else if (exportOptions.timePeriod === 'all') {
      console.log('🔍 Export: Showing all time data (no date filtering)');
      return evaluations;
    } else {
      // Dynamic month filtering - check if it's a month name
      const availableMonths = getAvailableMonths();
      const selectedMonth = availableMonths.find(m => m.value === exportOptions.timePeriod);
      
      if (selectedMonth) {
        const monthStart = new Date(selectedMonth.year, selectedMonth.monthIndex, 1);
        const monthEnd = new Date(selectedMonth.year, selectedMonth.monthIndex + 1, 0); // Last day of the month
        
        console.log(`🔍 Export: ${selectedMonth.label} range:`, monthStart.toISOString(), 'to', monthEnd.toISOString());
        
        return evaluations.filter(evaluation => {
          const evalDate = new Date(evaluation.visitDate + 'T00:00:00');
          const isInMonth = evalDate >= monthStart && evalDate <= monthEnd;
          console.log(`🔍 Export: Evaluation ${evaluation.visitDate} in ${selectedMonth.label}: ${isInMonth}`);
          return isInMonth;
        });
      }
    }
    
    console.log('🔍 Export: No date filtering applied, returning all evaluations');
    return evaluations;
  };

  const filterEvaluationsByScope = (evaluations: Evaluation[]): Evaluation[] => {
    console.log('🔍 Export: Filtering evaluations by scope:', exportOptions.scope);
    console.log('🔍 Export: Total evaluations to filter:', evaluations.length);
    
    switch (exportOptions.scope) {
      case 'company':
        console.log('🔍 Export: Returning all evaluations for company');
        return evaluations; // All evaluations for sales directors
      
      case 'regional-manager':
        if (exportOptions.selectedRegionalManager) {
          console.log('🔍 Export: Filtering for Regional Manager:', exportOptions.selectedRegionalManager);
          // For regional manager scope, we want evaluations where:
          // 1. The regional manager created the evaluation (managerId)
          // 2. The regional manager is being evaluated (salespersonId) 
          // 3. Any evaluation involving their team members
          const filtered = evaluations.filter(evaluation => {
            const isManagerCreated = evaluation.managerId === exportOptions.selectedRegionalManager;
            const isManagerEvaluated = evaluation.salespersonId === exportOptions.selectedRegionalManager;
            
            // Also include evaluations created by sales leads in this regional manager's team
            const salesLeadIds = salesLeads.map(sl => sl.id);
            const isTeamMemberCreated = salesLeadIds.includes(evaluation.managerId);
            const isTeamMemberEvaluated = salesLeadIds.includes(evaluation.salespersonId) || 
                                        salespeople.map(sp => sp.id).includes(evaluation.salespersonId);
            
            return isManagerCreated || isManagerEvaluated || isTeamMemberCreated || isTeamMemberEvaluated;
          });
          console.log('🔍 Export: Filtered evaluations for RM:', filtered.length);
          return filtered;
        }
        return evaluations;
      
      case 'sales-lead':
        if (exportOptions.selectedSalesLead) {
          console.log('🔍 Export: Filtering for Sales Lead:', exportOptions.selectedSalesLead);
          // For sales lead scope, we want evaluations where:
          // 1. The sales lead created the evaluation (managerId)
          // 2. The sales lead is being evaluated (salespersonId)
          // 3. Any evaluation involving their salespeople
          const filtered = evaluations.filter(evaluation => {
            const isSalesLeadCreated = evaluation.managerId === exportOptions.selectedSalesLead;
            const isSalesLeadEvaluated = evaluation.salespersonId === exportOptions.selectedSalesLead;
            
            // Include evaluations of salespeople managed by this sales lead
            const salespersonIds = salespeople.map(sp => sp.id);
            const isTeamMemberEvaluated = salespersonIds.includes(evaluation.salespersonId);
            
            return isSalesLeadCreated || isSalesLeadEvaluated || isTeamMemberEvaluated;
          });
          console.log('🔍 Export: Filtered evaluations for Sales Lead:', filtered.length);
          return filtered;
        }
        return evaluations;
      
      case 'individual':
        if (exportOptions.selectedSalesperson) {
          console.log('🔍 Export: Filtering for individual salesperson:', exportOptions.selectedSalesperson);
          const filtered = evaluations.filter(evaluation => evaluation.salespersonId === exportOptions.selectedSalesperson);
          console.log('🔍 Export: Filtered evaluations for individual:', filtered.length);
          return filtered;
        }
        return evaluations;
      
      default:
        return evaluations;
    }
  };

  const filterEvaluationsByDataType = (evaluations: Evaluation[]): Evaluation[] => {
    switch (exportOptions.dataType) {
      case 'coaching':
        return evaluations.filter(evaluation => 
          evaluation.items.some(item => 
            item.behaviorItemId.startsWith('obs') || 
            item.behaviorItemId.startsWith('env') || 
            item.behaviorItemId.startsWith('fb') || 
            item.behaviorItemId.startsWith('act')
          )
        );
      case 'behavior':
        return evaluations.filter(evaluation => 
          evaluation.items.some(item => 
            item.behaviorItemId.includes('_prep') || 
            item.behaviorItemId.includes('_prob') || 
            item.behaviorItemId.includes('_obj') || 
            item.behaviorItemId.includes('_prop')
          )
        );
      case 'both':
      case 'analytics':
      default:
        return evaluations;
    }
  };

  const exportToCSV = (evaluations: Evaluation[]) => {
    const headers = [
      'Evaluation ID',
      'Date',
      'Salesperson',
      'Manager',
      'Customer',
      'Location',
      'Category',
      'Score',
      'Comment',
      'Overall Score',
      'Overall Comment'
    ];

    const rows = evaluations.flatMap(evaluation => 
      evaluation.items.map(item => [
        evaluation.id,
        evaluation.visitDate,
        evaluation.salesperson.displayName || evaluation.salesperson.email,
        evaluation.manager.displayName || evaluation.manager.email,
        evaluation.customerName || '',
        evaluation.location || '',
        item.behaviorItem.category?.name || 'Unknown',
        item.rating || 0,
        item.comment || '',
        evaluation.overallScore || 0,
        evaluation.overallComment || ''
      ])
    );

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `evaluations_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = (evaluations: Evaluation[]) => {
    // For now, fallback to CSV since we don't have SheetJS library
    // In a full implementation, we'd use XLSX library
    exportToCSV(evaluations);
  };

  const exportToPDF = (evaluations: Evaluation[]) => {
    // For now, fallback to CSV since we don't have PDF generation library
    // In a full implementation, we'd use jsPDF library
    exportToCSV(evaluations);
  };

  const getScopeOptions = () => {
    if (user?.role === 'SALES_DIRECTOR') {
      return [
        { value: 'company', label: 'Company Wide' },
        { value: 'regional-manager', label: 'Regional Manager Team' },
        { value: 'sales-lead', label: 'Sales Lead Team' },
        { value: 'individual', label: 'Individual Salesperson' }
      ];
    } else if (user?.role === 'REGIONAL_MANAGER' || user?.role === 'REGIONAL_SALES_MANAGER') {
      return [
        { value: 'regional-manager', label: 'My Team (All Sales Leads + Salespeople)' },
        { value: 'sales-lead', label: 'Specific Sales Lead Team' },
        { value: 'individual', label: 'Individual Salesperson' }
      ];
    } else if (user?.role === 'SALES_LEAD') {
      return [
        { value: 'sales-lead', label: 'My Team' },
        { value: 'individual', label: 'Individual Salesperson' }
      ];
    }
    return [];
  };

  return (
    <div className="export-view">
      <div className="export-header">
        <h2>📤 Export Data</h2>
        <p>Export evaluation data for analysis and reporting</p>
      </div>

      <div className="export-form">
        {/* Step 1: Export Scope */}
        <div className="export-section">
          <h3>👥 Export Scope</h3>
          <div className="scope-options">
            {getScopeOptions().map(option => (
              <label key={option.value} className="scope-option">
                <input
                  type="radio"
                  name="scope"
                  value={option.value}
                  checked={exportOptions.scope === option.value}
                  onChange={(e) => handleScopeChange(e.target.value as ExportOptions['scope'])}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Step 2: Specific Selection (if not company-wide) */}
        {exportOptions.scope !== 'company' && (
          <div className="export-section">
            <h3>🎯 Select Specific</h3>
            {exportOptions.scope === 'regional-manager' && (
              <select
                value={exportOptions.selectedRegionalManager || ''}
                onChange={(e) => setExportOptions(prev => ({ ...prev, selectedRegionalManager: e.target.value }))}
                className="export-select"
              >
                <option value="">Choose Regional Manager</option>
                {regionalManagers.map(rm => (
                  <option key={rm.id} value={rm.id}>
                    {rm.displayName || rm.email}
                  </option>
                ))}
              </select>
            )}
            
            {exportOptions.scope === 'sales-lead' && (
              <select
                value={exportOptions.selectedSalesLead || ''}
                onChange={(e) => setExportOptions(prev => ({ ...prev, selectedSalesLead: e.target.value }))}
                className="export-select"
              >
                <option value="">Choose Sales Lead</option>
                {salesLeads.map(sl => (
                  <option key={sl.id} value={sl.id}>
                    {sl.displayName || sl.email}
                  </option>
                ))}
              </select>
            )}
            
            {exportOptions.scope === 'individual' && (
              <select
                value={exportOptions.selectedSalesperson || ''}
                onChange={(e) => setExportOptions(prev => ({ ...prev, selectedSalesperson: e.target.value }))}
                className="export-select"
              >
                <option value="">Choose Salesperson</option>
                {salespeople.map(sp => (
                  <option key={sp.id} value={sp.id}>
                    {sp.displayName || sp.email}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Step 3: Data Type */}
        <div className="export-section">
          <h3>📊 Data Type</h3>
          <div className="data-type-options">
            <label className="data-type-option">
              <input
                type="radio"
                name="dataType"
                value="coaching"
                checked={exportOptions.dataType === 'coaching'}
                onChange={(e) => setExportOptions(prev => ({ ...prev, dataType: e.target.value as ExportOptions['dataType'] }))}
              />
              <span>Coaching Evaluations Only</span>
            </label>
            <label className="data-type-option">
              <input
                type="radio"
                name="dataType"
                value="behavior"
                checked={exportOptions.dataType === 'behavior'}
                onChange={(e) => setExportOptions(prev => ({ ...prev, dataType: e.target.value as ExportOptions['dataType'] }))}
              />
              <span>Sales Behavior Evaluations Only</span>
            </label>
            <label className="data-type-option">
              <input
                type="radio"
                name="dataType"
                value="both"
                checked={exportOptions.dataType === 'both'}
                onChange={(e) => setExportOptions(prev => ({ ...prev, dataType: e.target.value as ExportOptions['dataType'] }))}
              />
              <span>Both Coaching & Sales Behavior</span>
            </label>
            <label className="data-type-option">
              <input
                type="radio"
                name="dataType"
                value="analytics"
                checked={exportOptions.dataType === 'analytics'}
                onChange={(e) => setExportOptions(prev => ({ ...prev, dataType: e.target.value as ExportOptions['dataType'] }))}
              />
              <span>Performance Analytics Summary</span>
            </label>
          </div>
        </div>

        {/* Step 4: Time Period */}
        <div className="export-section">
          <h3>📅 Time Period</h3>
          <div className="time-period-options">
            <label className="time-period-option">
              <input
                type="radio"
                name="timePeriod"
                value="all"
                checked={exportOptions.timePeriod === 'all'}
                onChange={(e) => setExportOptions(prev => ({ ...prev, timePeriod: e.target.value as ExportOptions['timePeriod'] }))}
              />
              <span>All Time</span>
            </label>
            <label className="time-period-option">
              <input
                type="radio"
                name="timePeriod"
                value="month"
                checked={exportOptions.timePeriod === 'month'}
                onChange={(e) => setExportOptions(prev => ({ ...prev, timePeriod: e.target.value as ExportOptions['timePeriod'] }))}
              />
              <span>Last Month</span>
            </label>
            <label className="time-period-option">
              <input
                type="radio"
                name="timePeriod"
                value="quarter"
                checked={exportOptions.timePeriod === 'quarter'}
                onChange={(e) => setExportOptions(prev => ({ ...prev, timePeriod: e.target.value as ExportOptions['timePeriod'] }))}
              />
              <span>Last 3 Months</span>
            </label>
            
            {/* Specific Month Option - Collapsible */}
            <label className="time-period-option">
              <input
                type="radio"
                name="timePeriod"
                value="specific-month"
                checked={exportOptions.timePeriod !== 'all' && exportOptions.timePeriod !== 'month' && exportOptions.timePeriod !== 'quarter' && exportOptions.timePeriod !== 'custom' && getAvailableMonths().some(m => m.value === exportOptions.timePeriod)}
                onChange={handleSpecificMonthClick}
              />
              <span>Specific Month</span>
            </label>
            
            {/* Collapsible Month Options */}
            {showMonthOptions && (
              <div className="month-options-container">
                <div className="month-options-header">
                  <h4>Select Month:</h4>
                </div>
                <div className="month-options-grid">
                  {getAvailableMonths().map(month => (
                    <button
                      key={month.value}
                      type="button"
                      className={`month-option-button ${exportOptions.timePeriod === month.value ? 'selected' : ''}`}
                      onClick={() => handleMonthSelection(month.value)}
                    >
                      {month.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <label className="time-period-option">
              <input
                type="radio"
                name="timePeriod"
                value="custom"
                checked={exportOptions.timePeriod === 'custom'}
                onChange={(e) => setExportOptions(prev => ({ ...prev, timePeriod: e.target.value as ExportOptions['timePeriod'] }))}
              />
              <span>Custom Range</span>
            </label>
          </div>
          
          {exportOptions.timePeriod === 'custom' && (
            <div className="custom-date-range">
              <input
                type="date"
                value={exportOptions.startDate || ''}
                onChange={(e) => setExportOptions(prev => ({ ...prev, startDate: e.target.value }))}
                className="date-input"
              />
              <span>to</span>
              <input
                type="date"
                value={exportOptions.endDate || ''}
                onChange={(e) => setExportOptions(prev => ({ ...prev, endDate: e.target.value }))}
                className="date-input"
              />
            </div>
          )}
        </div>

        {/* Step 5: Export Format */}
        <div className="export-section">
          <h3>📁 Export Format</h3>
          <div className="format-options">
            <label className="format-option">
              <input
                type="radio"
                name="format"
                value="csv"
                checked={exportOptions.format === 'csv'}
                onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as ExportOptions['format'] }))}
              />
              <span>CSV (Universal)</span>
            </label>
            <label className="format-option">
              <input
                type="radio"
                name="format"
                value="excel"
                checked={exportOptions.format === 'excel'}
                onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as ExportOptions['format'] }))}
              />
              <span>Excel (Detailed)</span>
            </label>
            <label className="format-option">
              <input
                type="radio"
                name="format"
                value="pdf"
                checked={exportOptions.format === 'pdf'}
                onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as ExportOptions['format'] }))}
              />
              <span>PDF Report</span>
            </label>
          </div>
        </div>

        {/* Export Button */}
        <div className="export-actions">
          {error && <div className="error-message">{error}</div>}
          <button
            onClick={handleExport}
            disabled={isLoading}
            className="export-button"
          >
            {isLoading ? '🔄 Generating...' : '📤 Generate Export'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportView;
