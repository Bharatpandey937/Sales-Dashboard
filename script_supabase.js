// async function loadDashboard() {

const SUPABASE_URL = "https://vswsvxunvqkqlstkzkpi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzd3N2eHVudnFrcWxzdGt6a3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NjM2OTYsImV4cCI6MjEwMzIzOTY5Nn0.3hEjPeURcT5SP8qbq7zpuxqTtR7AK4u3aqgCEjN5r-I";

let currentTheme = localStorage.getItem('dashboard-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
let lastDailySummaryData = [];
let lastMonthlySummaryData = [];

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dashboard-theme', theme);

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
        themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }

    if (lastDailySummaryData.length) {
        daily_summary_graph(lastDailySummaryData);
    }
    if (lastMonthlySummaryData.length) {
        monthly_summary_graph(lastMonthlySummaryData);
    }
}

function toggleTheme() {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

// Local payload fallback
const LOCAL_PAYLOAD = {
    "complete_info_data": [
        { "dashboard_data": { "daily_summary": [], "monthly_summary": [], "KPI_METRIC_CARD": [], "employee_table": [] } }
    ]
};

// Create Supabase client only if library is present
let sb = null;
if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    try {
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
        console.warn('Supabase client init failed, will use local payload', e);
        sb = null;
    }
}

function getDashboardFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;

    const extractDashboard = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj.dashboard_data) return obj.dashboard_data;
        if (obj.complete_info_data) {
            const inner = obj.complete_info_data;
            if (Array.isArray(inner) && inner[0] && inner[0].dashboard_data) return inner[0].dashboard_data;
            if (inner.dashboard_data) return inner.dashboard_data;
        }
        return null;
    };

    const candidate = Array.isArray(payload) ? payload[0] || {} : payload;
    const dashboard = extractDashboard(candidate) || extractDashboard(payload);
    if (dashboard) return dashboard;

    const knownKeys = [
        'today_performance',
        'prev_month',
        'prev_month_same_day',
        'month_mtd',
        'daily_summary',
        'monthly_summary',
        'daily_leaderboard'
    ];

    if (knownKeys.some((key) => key in candidate)) {
        return candidate;
    }

    return null;
}

function buildKpiCardData(dashboard) {
    if (dashboard.KPI_METRIC_CARD && Array.isArray(dashboard.KPI_METRIC_CARD) && dashboard.KPI_METRIC_CARD[0]) {
        return dashboard.KPI_METRIC_CARD[0];
    }

    return {
        TODAY_SALES: dashboard.today_performance?.orders ?? dashboard.today_performance?.sales ?? dashboard.today_performance?.today_sales,
        TODAY_REVENUE: dashboard.today_performance?.revenue ?? dashboard.today_performance?.today_revenue,
        MTD_SALES: dashboard.month_mtd?.orders ?? dashboard.month_mtd?.sales,
        MTD_REVENUE: dashboard.month_mtd?.revenue,
        'previous same day': dashboard.prev_month_same_day?.orders ?? dashboard.prev_month_same_day?.sales,
        'previous same day_REVENUE': dashboard.prev_month_same_day?.revenue,
        previous_MTD_SALES: dashboard.prev_month?.orders ?? dashboard.prev_month?.sales,
        previous_MTD_REVENUE: dashboard.prev_month?.revenue
    };
}

function getRecordValue(record, keys) {
    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if (record && record[key] != null) return record[key];
    }
    return null;
}

function formatValue(value) {
    return value == null || value === '' ? '-' : value;
}

function getThemeColor(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

async function loadDashboard() {
    const dateInput = document.getElementById('currentdate');
    const date = dateInput?.value || new Date().toISOString().slice(0, 10);

    // Fetch via Supabase RPC when available, otherwise use LOCAL_PAYLOAD
    let payload = null;
    if (sb) {
        try {
            const { data: rpcData, error: rpcError } = await sb.rpc('dashboard_data', { report_date: date });
            if (rpcError) {
                console.error('Supabase RPC error', rpcError);
                payload = LOCAL_PAYLOAD;
            } else {
                payload = rpcData;
            }
        } catch (e) {
            console.error('Supabase RPC failed', e);
            payload = LOCAL_PAYLOAD;
        }
    } else {
        payload = LOCAL_PAYLOAD;
    }

    const dashboard = getDashboardFromPayload(payload);
    if (!dashboard) {
        console.error('Unexpected payload shape', payload);
        return;
    }

    const kpi_card_data = {
        TODAY_SALES: dashboard.today_performance?.orders,
        TODAY_REVENUE: dashboard.today_performance?.revenue,
        MTD_SALES: dashboard.month_mtd?.orders,
        MTD_REVENUE: dashboard.month_mtd?.revenue,
        PREV_SAME_DAY_ORDERS: dashboard.prev_month_same_day?.orders,
        PREV_SAME_DAY_REVENUE: dashboard.prev_month_same_day?.revenue,
        PREV_MONTH_ORDERS: dashboard.prev_month?.orders,
        PREV_MONTH_REVENUE: dashboard.prev_month?.revenue
    };

    document.getElementById("today_orders").textContent = formatValue(kpi_card_data.TODAY_SALES);
    document.getElementById("today_revenue").textContent = formatValue(kpi_card_data.TODAY_REVENUE);
    document.getElementById("monthly_orders").textContent = formatValue(kpi_card_data.MTD_SALES);
    document.getElementById("monthly_revenue").textContent = formatValue(kpi_card_data.MTD_REVENUE);
    document.getElementById("previous_month_same_day_orders").textContent = formatValue(kpi_card_data.PREV_SAME_DAY_ORDERS);
    document.getElementById("previous_month_same_day_revenue").textContent = formatValue(kpi_card_data.PREV_SAME_DAY_REVENUE);
    document.getElementById("previous_month_orders").textContent = formatValue(kpi_card_data.PREV_MONTH_ORDERS);
    document.getElementById("previous_month_revenue").textContent = formatValue(kpi_card_data.PREV_MONTH_REVENUE);

    // employee performance
    const employee_data = dashboard.daily_leaderboard || [];

    let table_data = "";
    
    for (let i = 0; i < employee_data.length; i++) {
        const emp = employee_data[i];
        const name = emp.sales_rep || 'Unassigned';
        const todaySales = formatValue(emp.day_orders);
        const todayRevenue = formatValue(emp.day_revenue);
        const monthSales = formatValue(emp.mtd_orders);
        const monthRevenue = formatValue(emp.mtd_revenue);

        table_data += `
        <tr>
            <td>${i + 1}</td>
            <td>${name}</td>
            <td>${todaySales}</td>
            <td>${todayRevenue}</td>
            <td>${monthSales}</td>
            <td>${monthRevenue}</td>
        </tr>
        `;
    }
    document.getElementById("emp_data").innerHTML = table_data;

    const rawDaily = dashboard.daily_summary || [];
    const daily_summary_data = rawDaily.map(r => ({ date: r.date, sales: r.orders }));
    lastDailySummaryData = daily_summary_data;
    daily_summary_graph(daily_summary_data);

    const rawMonthly = dashboard.monthly_summary || [];
    const monthly_summary_data = rawMonthly.map(r => ({ month: r.month, sales: r.orders }));
    lastMonthlySummaryData = monthly_summary_data;
    monthly_summary_graph(monthly_summary_data);
}

let dailysummaryChart; // Global variable

function daily_summary_graph(daily_summary_data) {

    const date = [];
    const sales = [];

    for (let i = 0; i < daily_summary_data.length; i++) {
        date.push(daily_summary_data[i].date);
        sales.push(daily_summary_data[i].sales);
    }

    const ctx = document.getElementById("daily_summary_graph");
    if (!ctx) return;

    const primaryColor = getThemeColor('--accent-2', '#237a8a');
    const secondaryColor = getThemeColor('--accent', '#ef6c45');
    const panelColor = getThemeColor('--panel', '#ffffff');
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, `${primaryColor}59`);
    gradient.addColorStop(1, `${secondaryColor}0d`);

    if (dailysummaryChart) {
        dailysummaryChart.destroy();
    }

    dailysummaryChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: date,
            datasets: [{
                label: 'Sales',
                data: sales,
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 3.5,
                pointHoverRadius: 6,
                pointBackgroundColor: secondaryColor,
                pointBorderColor: panelColor,
                pointBorderWidth: 2,
                fill: true,
                backgroundColor: gradient,
                borderColor: primaryColor,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#0f172a',
                        boxWidth: 12
                    }
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    displayColors: false
                }
            },
            scales: {
                x: {
                    ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#64748b' },
                    grid: { color: 'rgba(148, 163, 184, 0.2)' }
                },
                y: {
                    ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#64748b' },
                    grid: { color: 'rgba(148, 163, 184, 0.2)' }
                }
            }
        }
    })
};
// monthly summary graph

let monthlysummarychart;

function monthly_summary_graph(monthly_summary_data){
    const month=[]
    const sales=[]

    for(var i=0;i<monthly_summary_data.length;i++){
        month.push(monthly_summary_data[i].month)
        sales.push(monthly_summary_data[i].sales)
    }
    const ctx = document.getElementById("monthly_summary_graph");
    if (!ctx) return;

    const primaryColor = getThemeColor('--accent-2', '#237a8a');
    const secondaryColor = getThemeColor('--accent', '#ef6c45');
    const panelColor = getThemeColor('--panel', '#ffffff');
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, `${secondaryColor}59`);
    gradient.addColorStop(1, `${primaryColor}0d`);

    if(monthlysummarychart){
        monthlysummarychart.destroy();
    }
    
    monthlysummarychart =new Chart(ctx,{
        type:"line",
        data:{
            labels:month,
            datasets:[{
                label: 'Sales',
                data: sales,
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 3.5,
                pointHoverRadius: 6,
                pointBackgroundColor: primaryColor,
                pointBorderColor: panelColor,
                pointBorderWidth: 2,
                fill: true,
                backgroundColor: gradient,
                borderColor: secondaryColor,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#0f172a',
                        boxWidth: 12
                    }
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    displayColors: false
                }
            },
            scales: {
                x: {
                    ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#64748b' },
                    grid: { color: 'rgba(148, 163, 184, 0.2)' }
                },
                y: {
                    ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#64748b' },
                    grid: { color: 'rgba(148, 163, 184, 0.2)' }
                }
            }
        }
    })
};

document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('currentdate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    setTheme(currentTheme);

    loadDashboard().catch((error) => {
        console.error('Unable to load dashboard', error);
    });
});

