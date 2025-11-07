/**
 * COMPOSANT CHART
 *
 * Wrapper autour de Chart.js pour faciliter la création de graphiques
 */

class ChartComponent {
  /**
   * Constructeur
   *
   * @param {string|HTMLElement} canvasElement - ID du canvas ou élément canvas
   */
  constructor(canvasElement) {
    if (typeof canvasElement === 'string') {
      this.canvas = document.getElementById(canvasElement);
    } else {
      this.canvas = canvasElement;
    }

    if (!this.canvas) {
      console.error('Canvas not found:', canvasElement);
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.chart = null;
  }

  /**
   * Crée un graphique linéaire
   *
   * @param {Object} data - Données du graphique
   * @param {Object} options - Options de configuration
   * @returns {Chart} Instance Chart.js
   */
  createLineChart(data, options = {}) {
    if (!this.ctx || typeof Chart === 'undefined') {
      console.error('Chart.js not loaded or canvas not available');
      return null;
    }

    // Configuration par défaut pour graphiques linéaires
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

    // Merger les options
    const finalOptions = this.mergeDeep(defaultOptions, options);

    // Détruire le graphique existant si présent
    if (this.chart) {
      this.chart.destroy();
    }

    // Créer le nouveau graphique
    this.chart = new Chart(this.ctx, {
      type: 'line',
      data: data,
      options: finalOptions
    });

    return this.chart;
  }

  /**
   * Crée un graphique en donut
   *
   * @param {Object} data - Données du graphique
   * @param {Object} options - Options de configuration
   * @returns {Chart} Instance Chart.js
   */
  createDoughnutChart(data, options = {}) {
    if (!this.ctx || typeof Chart === 'undefined') {
      console.error('Chart.js not loaded or canvas not available');
      return null;
    }

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

    const finalOptions = this.mergeDeep(defaultOptions, options);

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(this.ctx, {
      type: 'doughnut',
      data: data,
      options: finalOptions
    });

    return this.chart;
  }

  /**
   * Crée un graphique en barres
   *
   * @param {Object} data - Données du graphique
   * @param {Object} options - Options de configuration
   * @returns {Chart} Instance Chart.js
   */
  createBarChart(data, options = {}) {
    if (!this.ctx || typeof Chart === 'undefined') {
      console.error('Chart.js not loaded or canvas not available');
      return null;
    }

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(75, 85, 99, 0.2)'
          }
        }
      }
    };

    const finalOptions = this.mergeDeep(defaultOptions, options);

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(this.ctx, {
      type: 'bar',
      data: data,
      options: finalOptions
    });

    return this.chart;
  }

  /**
   * Met à jour les données du graphique
   *
   * @param {Object} newData - Nouvelles données
   */
  updateChart(newData) {
    if (!this.chart) {
      console.warn('No chart to update');
      return;
    }

    this.chart.data = newData;
    this.chart.update('active');
  }

  /**
   * Met à jour seulement les datasets
   *
   * @param {Array} newDatasets - Nouveaux datasets
   */
  updateDatasets(newDatasets) {
    if (!this.chart) {
      console.warn('No chart to update');
      return;
    }

    this.chart.data.datasets = newDatasets;
    this.chart.update('active');
  }

  /**
   * Détruit le graphique et libère les ressources
   */
  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  /**
   * Récupère l'instance Chart.js
   *
   * @returns {Chart|null} Instance Chart.js
   */
  getInstance() {
    return this.chart;
  }

  /**
   * Merge profond de deux objets
   *
   * @param {Object} target - Objet cible
   * @param {Object} source - Objet source
   * @returns {Object} Objet mergé
   */
  mergeDeep(target, source) {
    const output = Object.assign({}, target);

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeDeep(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }

  /**
   * Vérifie si une valeur est un objet
   *
   * @param {*} item - Valeur à vérifier
   * @returns {boolean} True si objet
   */
  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
}

// Export pour utilisation en module ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChartComponent;
}

// Export global
if (typeof window !== 'undefined') {
  window.ChartComponent = ChartComponent;
}
