/**
 * COMPOSANT BADGE
 *
 * Composant badge de statut réutilisable
 */

class Badge {
  /**
   * Crée un badge de statut
   *
   * @param {Object} options - Configuration du badge
   * @param {string} options.status - Statut: 'success', 'warning', 'danger', 'info', 'neutral'
   * @param {string} options.text - Texte du badge
   * @param {string} [options.icon] - Nom de l'icône Lucide (optionnel)
   * @param {boolean} [options.pulse=false] - Animation pulse pour alertes
   * @param {string} [options.size='md'] - Taille: 'sm', 'md', 'lg'
   * @param {string} [options.className] - Classes CSS additionnelles
   *
   * @returns {string} HTML du badge
   */
  static render(options) {
    const {
      status,
      text,
      icon = null,
      pulse = false,
      size = 'md',
      className = ''
    } = options;

    const classes = [
      'sp-badge',
      `sp-badge--${status}`,
      `sp-badge--${size}`
    ];

    if (pulse) {
      classes.push('sp-badge--pulse');
    }

    if (className) {
      classes.push(className);
    }

    let content = '';

    if (icon) {
      content += `<i data-lucide="${icon}" class="sp-badge__icon"></i>`;
    }

    content += `<span class="sp-badge__text">${text}</span>`;

    return `<span class="${classes.join(' ')}">${content}</span>`;
  }

  /**
   * Crée un élément badge DOM
   *
   * @param {Object} options - Configuration du badge
   * @returns {HTMLSpanElement} L'élément badge créé
   */
  static create(options) {
    const html = this.render(options);
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    const badge = template.content.firstChild;

    // Initialiser les icônes Lucide
    if (window.lucide && options.icon) {
      requestAnimationFrame(() => {
        window.lucide.createIcons();
      });
    }

    return badge;
  }

  /**
   * Calcule le statut du stock d'un produit
   *
   * @param {Object} product - Objet produit
   * @param {number} product.stock_actuel - Stock actuel
   * @param {number} product.stock_minimum - Stock minimum
   *
   * @returns {Object} Configuration du badge de statut
   */
  static getStockStatus(product) {
    const { stock_actuel, stock_minimum } = product;

    if (stock_actuel === 0) {
      return {
        status: 'danger',
        text: 'Rupture',
        icon: 'x-circle',
        pulse: true
      };
    }

    if (stock_actuel <= stock_minimum) {
      return {
        status: 'warning',
        text: 'Stock bas',
        icon: 'alert-triangle',
        pulse: true
      };
    }

    return {
      status: 'success',
      text: 'En stock',
      icon: 'check-circle',
      pulse: false
    };
  }

  /**
   * Badges de statut prédéfinis
   */
  static presets = {
    stockOk: {
      status: 'success',
      text: 'En stock',
      icon: 'check-circle'
    },
    stockLow: {
      status: 'warning',
      text: 'Stock bas',
      icon: 'alert-triangle',
      pulse: true
    },
    stockOut: {
      status: 'danger',
      text: 'Rupture',
      icon: 'x-circle',
      pulse: true
    },
    new: {
      status: 'info',
      text: 'Nouveau',
      icon: 'sparkles'
    },
    active: {
      status: 'success',
      text: 'Actif',
      icon: 'check'
    },
    inactive: {
      status: 'neutral',
      text: 'Inactif',
      icon: 'minus'
    },
    pending: {
      status: 'warning',
      text: 'En attente',
      icon: 'clock'
    }
  };
}

// Export pour utilisation en module ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Badge;
}

// Export global
if (typeof window !== 'undefined') {
  window.Badge = Badge;
}
