/**
 * EXEMPLE DE CODE - NOUVEAU DASHBOARD INTERACTIF
 *
 * Ce fichier montre l'implémentation complète du nouveau dashboard
 * avec graphiques dynamiques, métriques, et fil d'activité temps réel.
 */

// ============================================================================
// COMPOSANT METRIC CARD
// ============================================================================

class MetricCard {
  /**
   * Crée une carte métrique pour le dashboard
   * @param {Object} options - Configuration de la carte
   */
  static render(options) {
    const {
      title,
      value,
      icon,
      iconColor = 'var(--sp-primary-500)',
      trend = null,
      loading = false
    } = options;

    // Template HTML
    const html = `
      <div class="sp-metric-card">
        <div class="sp-metric-card__header">
          <div class="sp-metric-card__icon" style="background-color: ${iconColor}20">
            <i data-lucide="${icon}" style="color: ${iconColor}"></i>
          </div>
          <h3 class="sp-metric-card__title">${title}</h3>
        </div>

        <div class="sp-metric-card__body">
          ${loading ? `
            <div class="sp-metric-card__loader">
              <div class="sp-spinner"></div>
            </div>
          ` : `
            <div class="sp-metric-card__value">${value}</div>
            ${trend ? this.renderTrend(trend) : ''}
          `}
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Affiche la tendance (variation vs période précédente)
   */
  static renderTrend(trend) {
    const { value, period, direction } = trend;
    const isPositive = direction === 'up';
    const icon = isPositive ? 'trending-up' : 'trending-down';
    const colorClass = isPositive ? 'sp-trend--positive' : 'sp-trend--negative';

    return `
      <div class="sp-metric-card__trend ${colorClass}">
        <i data-lucide="${icon}"></i>
        <span>${isPositive ? '+' : ''}${value}%</span>
        <span class="sp-metric-card__period">${period}</span>
      </div>
    `;
  }
}

// ============================================================================
// COMPOSANT CHART (Wrapper Chart.js)
// ============================================================================

class ChartComponent {
  constructor(canvasId) {
    this.canvasId = canvasId;
    this.chart = null;
  }

  /**
   * Crée un graphique linéaire
   */
  createLineChart(data, options = {}) {
    const ctx = document.getElementById(this.canvasId).getContext('2d');

    // Configuration par défaut
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#9ca3af',
            font: {
              family: 'Inter, system-ui, sans-serif',
              size: 12
            },
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#f9fafb',
          bodyColor: '#d1d5db',
          borderColor: '#374151',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: (context) => {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              // Format avec séparateurs de milliers et devise
              const value = context.parsed.y.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR'
              });
              return label + value;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            color: '#6b7280',
            font: {
              size: 11
            }
          }
        },
        y: {
          grid: {
            color: 'rgba(75, 85, 99, 0.2)',
            drawBorder: false
          },
          ticks: {
            color: '#6b7280',
            font: {
              size: 11
            },
            callback: (value) => {
              return value.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0
              });
            }
          }
        }
      }
    };

    // Merge options
    const finalOptions = { ...defaultOptions, ...options };

    // Créer le graphique
    this.chart = new Chart(ctx, {
      type: 'line',
      data: data,
      options: finalOptions
    });

    return this.chart;
  }

  /**
   * Crée un graphique en donut
   */
  createDoughnutChart(data, options = {}) {
    const ctx = document.getElementById(this.canvasId).getContext('2d');

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: {
            color: '#9ca3af',
            font: {
              family: 'Inter, system-ui, sans-serif',
              size: 12
            },
            usePointStyle: true,
            padding: 15
          }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#f9fafb',
          bodyColor: '#d1d5db',
          borderColor: '#374151',
          borderWidth: 1,
          padding: 12
        }
      }
    };

    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: data,
      options: { ...defaultOptions, ...options }
    });

    return this.chart;
  }

  /**
   * Met à jour les données du graphique
   */
  updateChart(newData) {
    if (!this.chart) return;

    this.chart.data = newData;
    this.chart.update('active');
  }

  /**
   * Détruit le graphique
   */
  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}

// ============================================================================
// MODULE DASHBOARD
// ============================================================================

class DashboardModule {
  constructor() {
    this.charts = {};
    this.autoRefreshInterval = null;
    this.refreshRate = 60000; // 60 secondes
  }

  /**
   * Initialise le dashboard
   */
  async init() {
    console.log('📊 Initialisation du dashboard...');

    // Charger les données
    await this.loadMetrics();
    await this.loadCharts();
    await this.loadActivityFeed();
    await this.loadAlerts();

    // Démarrer le rafraîchissement automatique
    this.startAutoRefresh();

    // Événements
    this.bindEvents();

    console.log('✅ Dashboard initialisé');
  }

  /**
   * Charge les métriques du dashboard
   */
  async loadMetrics() {
    try {
      const response = await fetch('/wp-json/sempa/v1/dashboard/metrics', {
        headers: {
          'X-WP-Nonce': SempaStocksData.nonce
        }
      });

      const data = await response.json();
      this.renderMetrics(data);
    } catch (error) {
      console.error('Erreur chargement métriques:', error);
      this.showNotification('Erreur lors du chargement des métriques', 'error');
    }
  }

  /**
   * Affiche les métriques
   */
  renderMetrics(data) {
    const container = document.getElementById('dashboard-metrics');
    if (!container) return;

    // Calculer la variation de valeur
    const valueChange = data.trends?.value_change_percent || 0;
    const valueTrend = {
      value: Math.abs(valueChange).toFixed(1),
      period: 'vs semaine précédente',
      direction: valueChange >= 0 ? 'up' : 'down'
    };

    // Calculer la variation de mouvements
    const movementsChange = data.trends?.movements_change_percent || 0;
    const movementsTrend = {
      value: Math.abs(movementsChange).toFixed(1),
      period: "vs hier",
      direction: movementsChange >= 0 ? 'up' : 'down'
    };

    // Générer les cartes métriques
    const html = `
      <div class="sp-metrics-grid">
        ${MetricCard.render({
          title: 'Produits en stock',
          value: data.total_products?.toLocaleString('fr-FR') || '0',
          icon: 'package',
          iconColor: '#3b82f6'
        })}

        ${MetricCard.render({
          title: 'Valeur totale du stock',
          value: (data.total_value || 0).toLocaleString('fr-FR', {
            style: 'currency',
            currency: 'EUR'
          }),
          icon: 'trending-up',
          iconColor: '#10b981',
          trend: valueTrend
        })}

        ${MetricCard.render({
          title: 'Alertes stock bas',
          value: data.low_stock_count || '0',
          icon: 'alert-triangle',
          iconColor: '#f59e0b'
        })}

        ${MetricCard.render({
          title: "Mouvements aujourd'hui",
          value: data.movements_today || '0',
          icon: 'activity',
          iconColor: '#8b5cf6',
          trend: movementsTrend
        })}
      </div>
    `;

    container.innerHTML = html;

    // Initialiser les icônes Lucide
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  /**
   * Charge les graphiques
   */
  async loadCharts() {
    try {
      // Graphique évolution valeur du stock (30 derniers jours)
      const valueResponse = await fetch('/wp-json/sempa/v1/dashboard/charts/stock-value?period=30d', {
        headers: { 'X-WP-Nonce': SempaStocksData.nonce }
      });
      const valueData = await valueResponse.json();
      this.renderStockValueChart(valueData);

      // Graphique mouvements (7 derniers jours)
      const movementsResponse = await fetch('/wp-json/sempa/v1/dashboard/charts/movements?period=7d', {
        headers: { 'X-WP-Nonce': SempaStocksData.nonce }
      });
      const movementsData = await movementsResponse.json();
      this.renderMovementsChart(movementsData);

      // Graphique répartition par catégorie
      const categoriesResponse = await fetch('/wp-json/sempa/v1/dashboard/charts/categories', {
        headers: { 'X-WP-Nonce': SempaStocksData.nonce }
      });
      const categoriesData = await categoriesResponse.json();
      this.renderCategoriesChart(categoriesData);

    } catch (error) {
      console.error('Erreur chargement graphiques:', error);
    }
  }

  /**
   * Affiche le graphique évolution valeur stock
   */
  renderStockValueChart(data) {
    // Détruire graphique existant
    if (this.charts.stockValue) {
      this.charts.stockValue.destroy();
    }

    // Créer nouveau graphique
    this.charts.stockValue = new ChartComponent('chart-stock-value');

    const chartData = {
      labels: data.labels,
      datasets: [{
        label: 'Valeur du stock',
        data: data.values,
        borderColor: '#f4a412',
        backgroundColor: 'rgba(244, 164, 18, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#f4a412',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    };

    this.charts.stockValue.createLineChart(chartData);
  }

  /**
   * Affiche le graphique des mouvements
   */
  renderMovementsChart(data) {
    if (this.charts.movements) {
      this.charts.movements.destroy();
    }

    this.charts.movements = new ChartComponent('chart-movements');

    const chartData = {
      labels: data.labels,
      datasets: [
        {
          label: 'Entrées',
          data: data.entries,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2
        },
        {
          label: 'Sorties',
          data: data.exits,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2
        }
      ]
    };

    this.charts.movements.createLineChart(chartData);
  }

  /**
   * Affiche le graphique répartition catégories
   */
  renderCategoriesChart(data) {
    if (this.charts.categories) {
      this.charts.categories.destroy();
    }

    this.charts.categories = new ChartComponent('chart-categories');

    const chartData = {
      labels: data.labels,
      datasets: [{
        data: data.values,
        backgroundColor: [
          '#f4a412',
          '#10b981',
          '#3b82f6',
          '#8b5cf6',
          '#ec4899',
          '#f59e0b'
        ],
        borderColor: '#1f2937',
        borderWidth: 2
      }]
    };

    this.charts.categories.createDoughnutChart(chartData);
  }

  /**
   * Charge le fil d'activité temps réel
   */
  async loadActivityFeed() {
    try {
      const response = await fetch('/wp-json/sempa/v1/dashboard/activity?limit=10', {
        headers: { 'X-WP-Nonce': SempaStocksData.nonce }
      });

      const activities = await response.json();
      this.renderActivityFeed(activities);
    } catch (error) {
      console.error('Erreur chargement activités:', error);
    }
  }

  /**
   * Affiche le fil d'activité
   */
  renderActivityFeed(activities) {
    const container = document.getElementById('activity-feed');
    if (!container) return;

    if (!activities || activities.length === 0) {
      container.innerHTML = `
        <div class="sp-empty-state">
          <i data-lucide="activity"></i>
          <p>Aucune activité récente</p>
        </div>
      `;
      return;
    }

    const html = activities.map(activity => {
      const icon = this.getActivityIcon(activity.action);
      const color = this.getActivityColor(activity.action);
      const time = this.formatRelativeTime(activity.created_at);

      return `
        <div class="sp-activity-item">
          <div class="sp-activity-item__icon" style="background-color: ${color}20">
            <i data-lucide="${icon}" style="color: ${color}"></i>
          </div>
          <div class="sp-activity-item__content">
            <div class="sp-activity-item__description">
              <strong>${activity.user}</strong> ${this.getActivityText(activity)}
            </div>
            <div class="sp-activity-item__time">${time}</div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div class="sp-activity-feed">${html}</div>`;

    // Initialiser les icônes
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  /**
   * Récupère l'icône selon le type d'activité
   */
  getActivityIcon(action) {
    const icons = {
      'create': 'plus-circle',
      'update': 'edit',
      'delete': 'trash-2',
      'movement': 'arrow-right-left',
      'export': 'download'
    };
    return icons[action] || 'circle';
  }

  /**
   * Récupère la couleur selon le type d'activité
   */
  getActivityColor(action) {
    const colors = {
      'create': '#10b981',
      'update': '#3b82f6',
      'delete': '#ef4444',
      'movement': '#8b5cf6',
      'export': '#f59e0b'
    };
    return colors[action] || '#6b7280';
  }

  /**
   * Génère le texte descriptif de l'activité
   */
  getActivityText(activity) {
    const actions = {
      'create': `a créé le produit <code>${activity.details?.reference}</code>`,
      'update': `a modifié le produit <code>${activity.details?.reference}</code>`,
      'delete': `a supprimé le produit <code>${activity.details?.reference}</code>`,
      'movement': `a enregistré un mouvement (${activity.details?.type}) pour <code>${activity.details?.reference}</code>`,
      'export': `a exporté des données`
    };
    return actions[activity.action] || 'a effectué une action';
  }

  /**
   * Formate une date en temps relatif
   */
  formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR');
  }

  /**
   * Charge les alertes
   */
  async loadAlerts() {
    try {
      const response = await fetch('/wp-json/sempa/v1/dashboard/alerts', {
        headers: { 'X-WP-Nonce': SempaStocksData.nonce }
      });

      const alerts = await response.json();
      this.renderAlerts(alerts);
    } catch (error) {
      console.error('Erreur chargement alertes:', error);
    }
  }

  /**
   * Affiche les alertes
   */
  renderAlerts(alerts) {
    const container = document.getElementById('alerts-panel');
    if (!container) return;

    if (!alerts || alerts.length === 0) {
      container.innerHTML = `
        <div class="sp-empty-state">
          <i data-lucide="check-circle"></i>
          <p>Aucune alerte</p>
        </div>
      `;
      return;
    }

    const html = alerts.map(alert => `
      <div class="sp-alert-item">
        <div class="sp-alert-item__icon">
          <i data-lucide="alert-triangle"></i>
        </div>
        <div class="sp-alert-item__content">
          <div class="sp-alert-item__title">${alert.product.reference}</div>
          <div class="sp-alert-item__description">
            Stock: ${alert.product.stock_actuel} / Minimum: ${alert.product.stock_minimum}
          </div>
        </div>
        <button class="sp-btn sp-btn--sm sp-btn--outline" onclick="dashboard.showProductDetail(${alert.product.id})">
          Voir
        </button>
      </div>
    `).join('');

    container.innerHTML = html;

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  /**
   * Démarre le rafraîchissement automatique
   */
  startAutoRefresh() {
    // Arrêter l'intervalle existant
    this.stopAutoRefresh();

    // Démarrer nouveau rafraîchissement
    this.autoRefreshInterval = setInterval(() => {
      console.log('🔄 Rafraîchissement automatique du dashboard...');
      this.loadMetrics();
      this.loadActivityFeed();
      this.loadAlerts();
    }, this.refreshRate);

    console.log(`🔄 Rafraîchissement automatique activé (${this.refreshRate / 1000}s)`);
  }

  /**
   * Arrête le rafraîchissement automatique
   */
  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
      console.log('⏸️ Rafraîchissement automatique désactivé');
    }
  }

  /**
   * Bind les événements
   */
  bindEvents() {
    // Bouton rafraîchir manuel
    const refreshBtn = document.getElementById('btn-refresh-dashboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadMetrics();
        this.loadCharts();
        this.loadActivityFeed();
        this.loadAlerts();
      });
    }

    // Toggle auto-refresh
    const autoRefreshToggle = document.getElementById('toggle-auto-refresh');
    if (autoRefreshToggle) {
      autoRefreshToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.startAutoRefresh();
        } else {
          this.stopAutoRefresh();
        }
      });
    }
  }

  /**
   * Affiche le détail d'un produit
   */
  showProductDetail(productId) {
    // Rediriger vers la page produits avec le produit sélectionné
    window.location.hash = `#view-products?product=${productId}`;
  }

  /**
   * Affiche une notification
   */
  showNotification(message, type = 'info') {
    // À implémenter avec le composant Notification
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    this.stopAutoRefresh();

    // Détruire tous les graphiques
    Object.values(this.charts).forEach(chart => {
      if (chart && chart.destroy) {
        chart.destroy();
      }
    });

    this.charts = {};
  }
}

// ============================================================================
// INITIALISATION
// ============================================================================

// Créer instance globale
window.dashboard = new DashboardModule();

// Initialiser au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier si on est sur la vue dashboard
  if (window.location.hash === '#view-dashboard' || !window.location.hash) {
    dashboard.init();
  }
});

// Gérer la navigation SPA
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#view-dashboard') {
    dashboard.init();
  } else {
    dashboard.destroy();
  }
});

// Export pour utilisation dans d'autres modules
export { DashboardModule, MetricCard, ChartComponent };
