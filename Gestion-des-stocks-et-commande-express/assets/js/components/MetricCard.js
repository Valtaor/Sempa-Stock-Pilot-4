/**
 * COMPOSANT METRIC CARD
 *
 * Carte métrique pour le dashboard avec icône, valeur et tendance
 */

class MetricCard {
  /**
   * Crée une carte métrique
   *
   * @param {Object} options - Configuration de la carte
   * @param {string} options.title - Titre de la métrique
   * @param {string|number} options.value - Valeur à afficher
   * @param {string} [options.icon] - Nom de l'icône Lucide
   * @param {string} [options.iconColor] - Couleur de l'icône (variable CSS ou hex)
   * @param {Object} [options.trend] - Tendance (variation)
   * @param {number} options.trend.value - Valeur de variation (en %)
   * @param {string} options.trend.period - Période de comparaison
   * @param {string} options.trend.direction - Direction: 'up' ou 'down'
   * @param {boolean} [options.loading=false] - État de chargement
   * @param {string} [options.className] - Classes CSS additionnelles
   *
   * @returns {string} HTML de la carte métrique
   */
  static render(options) {
    const {
      title,
      value,
      icon = null,
      iconColor = 'var(--sp-primary-500)',
      trend = null,
      loading = false,
      className = ''
    } = options;

    const classes = ['sp-metric-card'];
    if (className) {
      classes.push(className);
    }

    // Icône avec couleur de fond transparente
    const iconHtml = icon ? `
      <div class="sp-metric-card__icon" style="background-color: ${iconColor}20">
        <i data-lucide="${icon}" style="color: ${iconColor}"></i>
      </div>
    ` : '';

    // Tendance (variation)
    const trendHtml = trend ? this.renderTrend(trend) : '';

    // État de chargement
    const bodyContent = loading ? `
      <div class="sp-metric-card__loader">
        ${Loader.render({ size: 'sm' })}
      </div>
    ` : `
      <div class="sp-metric-card__value">${value}</div>
      ${trendHtml}
    `;

    return `
      <div class="${classes.join(' ')}">
        <div class="sp-metric-card__header">
          ${iconHtml}
          <h3 class="sp-metric-card__title">${title}</h3>
        </div>
        <div class="sp-metric-card__body">
          ${bodyContent}
        </div>
      </div>
    `;
  }

  /**
   * Affiche la tendance (variation)
   *
   * @param {Object} trend - Données de tendance
   * @returns {string} HTML de la tendance
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

  /**
   * Crée un élément DOM de carte métrique
   *
   * @param {Object} options - Configuration de la carte
   * @returns {HTMLDivElement} L'élément carte créé
   */
  static create(options) {
    const html = this.render(options);
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    const card = template.content.firstChild;

    // Initialiser les icônes Lucide
    if (window.lucide) {
      requestAnimationFrame(() => {
        window.lucide.createIcons();
      });
    }

    return card;
  }

  /**
   * Met à jour la valeur d'une carte métrique
   *
   * @param {HTMLElement} card - L'élément carte
   * @param {string|number} newValue - Nouvelle valeur
   */
  static updateValue(card, newValue) {
    if (!card) return;

    const valueElement = card.querySelector('.sp-metric-card__value');
    if (valueElement) {
      valueElement.textContent = newValue;
    }
  }

  /**
   * Met à jour la tendance d'une carte métrique
   *
   * @param {HTMLElement} card - L'élément carte
   * @param {Object} trend - Nouvelle tendance
   */
  static updateTrend(card, trend) {
    if (!card) return;

    const trendElement = card.querySelector('.sp-metric-card__trend');
    if (trendElement) {
      const trendHtml = this.renderTrend(trend);
      trendElement.outerHTML = trendHtml;

      // Réinitialiser les icônes
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  }

  /**
   * Active/désactive l'état de chargement
   *
   * @param {HTMLElement} card - L'élément carte
   * @param {boolean} isLoading - État de chargement
   */
  static setLoading(card, isLoading) {
    if (!card) return;

    const bodyElement = card.querySelector('.sp-metric-card__body');
    if (!bodyElement) return;

    if (isLoading) {
      bodyElement.innerHTML = `
        <div class="sp-metric-card__loader">
          ${Loader.render({ size: 'sm' })}
        </div>
      `;
    } else {
      // Restaurer le contenu original si disponible
      if (card.dataset.originalValue) {
        bodyElement.innerHTML = `
          <div class="sp-metric-card__value">${card.dataset.originalValue}</div>
        `;
      }
    }
  }
}

// Export pour utilisation en module ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MetricCard;
}

// Export global
if (typeof window !== 'undefined') {
  window.MetricCard = MetricCard;
}
