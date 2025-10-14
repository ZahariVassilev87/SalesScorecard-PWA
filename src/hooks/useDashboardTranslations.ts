import { useTranslation } from 'react-i18next';

interface DashboardTranslations {
  directorTitle: string;
  directorSubtitle: string;
  performanceType: string;
  bothTypes: string;
  salesBehavioursOnly: string;
  coachingOnly: string;
  region: string;
  allRegions: string;
  unknownRegion: string;
  regionalManager: string;
  allRegionalManagers: string;
  salesLead: string;
  allSalesLeads: string;
  unknown: string;
  companyOverview: string;
  salesBehavioursPerformance: string;
  salesBehavioursEvaluations: string;
  avgSalesBehavioursScore: string;
  salespeopleEvaluated: string;
  salesLeadsEvaluating: string;
  coachingPerformance: string;
  coachingEvaluations: string;
  avgCoachingScore: string;
  salesLeadsEvaluated: string;
  regionalManagersEvaluating: string;
  teamOverview: string;
  totalSalespeople: string;
  totalSalesLeads: string;
  totalRegionalManagers: string;
  regionalSalesBehavioursPerformance: string;
  regionalSalesBehavioursDescription: string;
  salesBehavioursEvaluationsCount: string;
  salespeople: string;
  salesLeads: string;
  regionalCoachingPerformance: string;
  regionalCoachingDescription: string;
  coachingEvaluationsCount: string;
  regionalManagers: string;
  salesLeadSalesBehavioursPerformance: string;
  salesLeadSalesBehavioursDescription: string;
  avgSalesBehavioursScoreHeader: string;
  salesLeadCoachingPerformance: string;
  salesLeadCoachingDescription: string;
  coachingEvaluationsReceived: string;
  salesBehavioursTrends: string;
  salesBehavioursTrendsDescription: string;
  coachingTrends: string;
  coachingTrendsDescription: string;
  dataType: string;
  companyLevel: string;
  regionalLevel: string;
  salesLeadLevel: string;
  period: string;
  allTime: string;
  currentMonth: string;
  currentQuarter: string;
  customRange: string;
  shareOfWalletDistribution: string;
  shareOfWalletDescription: string;
  highShare: string;
  midShare: string;
  lowShare: string;
  totalEvaluations: string;
  avgScore: string;
  percentage: string;
}

export const useDashboardTranslations = (): DashboardTranslations => {
  const { i18n } = useTranslation();
  const isBulgarian = i18n.language === 'bg';

  // English translations (fallback)
  const englishTranslations: DashboardTranslations = {
    directorTitle: "Sales Director Dashboard",
    directorSubtitle: "Comprehensive overview of sales performance across all regions and teams",
    performanceType: "Performance Type",
    bothTypes: "Both Types",
    salesBehavioursOnly: "Sales Behaviours Only",
    coachingOnly: "Coaching Only",
    region: "Region",
    allRegions: "All Regions",
    unknownRegion: "Unknown Region",
    regionalManager: "Regional Manager",
    allRegionalManagers: "All Regional Managers",
    salesLead: "Sales Lead",
    allSalesLeads: "All Sales Leads",
    unknown: "Unknown",
    companyOverview: "Company Overview",
    salesBehavioursPerformance: "Sales Behaviours Performance",
    salesBehavioursEvaluations: "Sales Behaviours Evaluations",
    avgSalesBehavioursScore: "Average Sales Behaviours Score",
    salespeopleEvaluated: "Salespeople Evaluated",
    salesLeadsEvaluating: "Sales Leads Evaluating",
    coachingPerformance: "Coaching Performance",
    coachingEvaluations: "Coaching Evaluations",
    avgCoachingScore: "Average Coaching Score",
    salesLeadsEvaluated: "Sales Leads Evaluated",
    regionalManagersEvaluating: "Regional Managers Evaluating",
    teamOverview: "Team Overview",
    totalSalespeople: "Total Salespeople",
    totalSalesLeads: "Total Sales Leads",
    totalRegionalManagers: "Total Regional Managers",
    regionalSalesBehavioursPerformance: "Regional Sales Behaviours Performance",
    regionalSalesBehavioursDescription: "Sales behaviours evaluations by region",
    salesBehavioursEvaluationsCount: "Sales Behaviours Evaluations",
    salespeople: "Salespeople",
    salesLeads: "Sales Leads",
    regionalCoachingPerformance: "Regional Coaching Performance",
    regionalCoachingDescription: "Coaching evaluations by region",
    coachingEvaluationsCount: "Coaching Evaluations",
    regionalManagers: "Regional Managers",
    salesLeadSalesBehavioursPerformance: "Sales Lead Sales Behaviours Performance",
    salesLeadSalesBehavioursDescription: "Sales behaviours evaluations created by each sales lead",
    avgSalesBehavioursScoreHeader: "Average Score",
    salesLeadCoachingPerformance: "Sales Lead Coaching Performance",
    salesLeadCoachingDescription: "Coaching evaluations received by each sales lead",
    coachingEvaluationsReceived: "Coaching Evaluations Received",
    salesBehavioursTrends: "Sales Behaviours Trends",
    salesBehavioursTrendsDescription: "Recent sales behaviours evaluation trends",
    coachingTrends: "Coaching Trends",
    coachingTrendsDescription: "Recent coaching evaluation trends",
    dataType: "Data Type",
    companyLevel: "Company Level",
    regionalLevel: "Regional Level",
    salesLeadLevel: "Sales Lead Level",
    period: "Period",
    allTime: "All Time",
    currentMonth: "Current Month",
    currentQuarter: "Current Quarter",
    customRange: "Custom Range",
    shareOfWalletDistribution: "Share of Wallet Distribution",
    shareOfWalletDescription: "Distribution of evaluations by client type",
    highShare: "High Share of Wallet",
    midShare: "Mid Share of Wallet",
    lowShare: "Low Share of Wallet",
    totalEvaluations: "Total Evaluations",
    avgScore: "Average Score",
    percentage: "Percentage"
  };

  // Bulgarian translations
  const bulgarianTranslations: DashboardTranslations = {
    directorTitle: "Табло на Директор по Продажби",
    directorSubtitle: "Цялостен преглед на представянето на продажбите в всички региони и екипи",
    performanceType: "Тип представяне",
    bothTypes: "И двата типа",
    salesBehavioursOnly: "Само търговско поведение",
    coachingOnly: "Само коучинг",
    region: "Регион",
    allRegions: "Всички региони",
    unknownRegion: "Неизвестен регион",
    regionalManager: "Регионален мениджър",
    allRegionalManagers: "Всички регионални мениджъри",
    salesLead: "Търговски мениджър",
    allSalesLeads: "Всички търговски мениджъри",
    unknown: "Неизвестно",
    companyOverview: "Преглед на компанията",
    salesBehavioursPerformance: "Представяне на търговското поведение",
    salesBehavioursEvaluations: "Оценки на търговското поведение",
    avgSalesBehavioursScore: "Средна оценка на търговското поведение",
    salespeopleEvaluated: "Оценени продажбени представители",
    salesLeadsEvaluating: "Търговски мениджъри, които оценяват",
    coachingPerformance: "Представяне на коучинга",
    coachingEvaluations: "Оценки на коучинга",
    avgCoachingScore: "Средна оценка на коучинга",
    salesLeadsEvaluated: "Оценени търговски мениджъри",
    regionalManagersEvaluating: "Регионални мениджъри, които оценяват",
    teamOverview: "Преглед на екипа",
    totalSalespeople: "Общо продажбени представители",
    totalSalesLeads: "Общо търговски мениджъри",
    totalRegionalManagers: "Общо регионални мениджъри",
    regionalSalesBehavioursPerformance: "Регионално представяне на търговското поведение",
    regionalSalesBehavioursDescription: "Оценки на търговското поведение по региони",
    salesBehavioursEvaluationsCount: "Оценки на търговското поведение",
    salespeople: "Продажбени представители",
    salesLeads: "Търговски мениджъри",
    regionalCoachingPerformance: "Регионално представяне на коучинга",
    regionalCoachingDescription: "Оценки на коучинга по региони",
    coachingEvaluationsCount: "Оценки на коучинга",
    regionalManagers: "Регионални мениджъри",
    salesLeadSalesBehavioursPerformance: "Представяне на търговското поведение на търговски мениджъри",
    salesLeadSalesBehavioursDescription: "Оценки на търговското поведение, създадени от всеки търговски мениджър",
    avgSalesBehavioursScoreHeader: "Средна оценка",
    salesLeadCoachingPerformance: "Представяне на коучинга на търговски мениджъри",
    salesLeadCoachingDescription: "Оценки на коучинга, получени от всеки търговски мениджър",
    coachingEvaluationsReceived: "Получени оценки на коучинга",
    salesBehavioursTrends: "Трендове на търговското поведение",
    salesBehavioursTrendsDescription: "Скорошни трендове на оценки на търговското поведение",
    coachingTrends: "Трендове на коучинга",
    coachingTrendsDescription: "Скорошни трендове на оценки на коучинга",
    dataType: "Тип данни",
    companyLevel: "Ниво на компанията",
    regionalLevel: "Регионално ниво",
    salesLeadLevel: "Ниво на търговски мениджър",
    period: "Период",
    allTime: "Цялото време",
    currentMonth: "Текущия месец",
    currentQuarter: "Текущото тримесечие",
    customRange: "Персонализиран диапазон",
    shareOfWalletDistribution: "Разпределение на Дяла от Портфейла",
    shareOfWalletDescription: "Разпределение на оценките по тип клиент",
    highShare: "Висок дял от портфейла",
    midShare: "Среден дял от портфейла",
    lowShare: "Нисък дял от портфейла",
    totalEvaluations: "Общо оценки",
    avgScore: "Средна оценка",
    percentage: "Процент"
  };

  return isBulgarian ? bulgarianTranslations : englishTranslations;
};
