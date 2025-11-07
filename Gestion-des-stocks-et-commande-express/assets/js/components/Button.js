/**
 * COMPOSANT BUTTON
 *
 * Composant bouton réutilisable avec différentes variantes
 */

class Button {
  /**
   * Crée un élément bouton
   *
   * @param {Object} options - Configuration du bouton
   * @param {string} options.text - Texte du bouton
   * @param {string} [options.variant='primary'] - Variante: 'primary', 'secondary', 'outline', 'ghost', 'danger'
   * @param {string} [options.size='md'] - Taille: 'sm', 'md', 'lg'
   * @param {string} [options.icon] - Nom de l'icône Lucide
   * @param {string} [options.iconPosition='left'] - Position de l'icône: 'left', 'right'
   * @param {boolean} [options.iconOnly=false] - Afficher uniquement l'icône
   * @param {boolean} [options.loading=false] - État de chargement
   * @param {boolean} [options.disabled=false] - Bouton désactivé
   * @param {string} [options.type='button'] - Type du bouton: 'button', 'submit', 'reset'
   * @param {string} [options.className] - Classes CSS additionnelles
   * @param {Function} [options.onClick] - Fonction callback au clic
   * @param {Object} [options.attributes] - Attributs HTML additionnels
   *
   * @returns {HTMLButtonElement} L'élément bouton créé
   */
  static create(options) {
    const {
      text = '',
      variant = 'primary',
      size = 'md',
      icon = null,
      iconPosition = 'left',
      iconOnly = false,
      loading = false,
      disabled = false,
      type = 'button',
      className = '',
      onClick = null,
      attributes = {}
    } = options;

    // Créer l'élément bouton
    const button = document.createElement('button');
    button.type = type;

    // Classes CSS
    const classes = [
      'sp-btn',
      `sp-btn--${variant}`,
      `sp-btn--${size}`
    ];

    if (iconOnly) {
      classes.push('sp-btn--icon-only');
    }

    if (loading) {
      classes.push('sp-btn--loading');
    }

    if (className) {
      classes.push(className);
    }

    button.className = classes.join(' ');

    // État désactivé
    if (disabled || loading) {
      button.disabled = true;
    }

    // Contenu du bouton
    let content = '';

    // Icône de chargement
    if (loading) {
      content += '<span class="sp-btn__spinner"></span>';
    }

    // Icône à gauche
    if (icon && iconPosition === 'left' && !loading) {
      content += `<i data-lucide="${icon}" class="sp-btn__icon sp-btn__icon--left"></i>`;
    }

    // Texte
    if (text && !iconOnly) {
      content += `<span class="sp-btn__text">${text}</span>`;
    }

    // Icône seule
    if (icon && iconOnly && !loading) {
      content += `<i data-lucide="${icon}" class="sp-btn__icon"></i>`;
    }

    // Icône à droite
    if (icon && iconPosition === 'right' && !iconOnly && !loading) {
      content += `<i data-lucide="${icon}" class="sp-btn__icon sp-btn__icon--right"></i>`;
    }

    button.innerHTML = content;

    // Attributs additionnels
    Object.entries(attributes).forEach(([key, value]) => {
      button.setAttribute(key, value);
    });

    // Event listener
    if (onClick && typeof onClick === 'function') {
      button.addEventListener('click', onClick);
    }

    // Initialiser les icônes Lucide
    if (window.lucide && icon) {
      requestAnimationFrame(() => {
        window.lucide.createIcons();
      });
    }

    return button;
  }

  /**
   * Rend un bouton sous forme de chaîne HTML
   *
   * @param {Object} options - Configuration du bouton (mêmes options que create)
   * @returns {string} HTML du bouton
   */
  static render(options) {
    const {
      text = '',
      variant = 'primary',
      size = 'md',
      icon = null,
      iconPosition = 'left',
      iconOnly = false,
      loading = false,
      disabled = false,
      type = 'button',
      className = '',
      id = '',
      attributes = {}
    } = options;

    // Classes CSS
    const classes = [
      'sp-btn',
      `sp-btn--${variant}`,
      `sp-btn--${size}`
    ];

    if (iconOnly) {
      classes.push('sp-btn--icon-only');
    }

    if (loading) {
      classes.push('sp-btn--loading');
    }

    if (className) {
      classes.push(className);
    }

    // Attributs HTML
    const attrs = [`type="${type}"`, `class="${classes.join(' ')}"`];

    if (id) {
      attrs.push(`id="${id}"`);
    }

    if (disabled || loading) {
      attrs.push('disabled');
    }

    Object.entries(attributes).forEach(([key, value]) => {
      attrs.push(`${key}="${value}"`);
    });

    // Contenu du bouton
    let content = '';

    // Icône de chargement
    if (loading) {
      content += '<span class="sp-btn__spinner"></span>';
    }

    // Icône à gauche
    if (icon && iconPosition === 'left' && !loading) {
      content += `<i data-lucide="${icon}" class="sp-btn__icon sp-btn__icon--left"></i>`;
    }

    // Texte
    if (text && !iconOnly) {
      content += `<span class="sp-btn__text">${text}</span>`;
    }

    // Icône seule
    if (icon && iconOnly && !loading) {
      content += `<i data-lucide="${icon}" class="sp-btn__icon"></i>`;
    }

    // Icône à droite
    if (icon && iconPosition === 'right' && !iconOnly && !loading) {
      content += `<i data-lucide="${icon}" class="sp-btn__icon sp-btn__icon--right"></i>`;
    }

    return `<button ${attrs.join(' ')}>${content}</button>`;
  }

  /**
   * Met à jour l'état de chargement d'un bouton
   *
   * @param {HTMLButtonElement} button - L'élément bouton
   * @param {boolean} isLoading - État de chargement
   */
  static setLoading(button, isLoading) {
    if (!button) return;

    if (isLoading) {
      button.classList.add('sp-btn--loading');
      button.disabled = true;

      // Remplacer le contenu par un spinner
      const originalContent = button.innerHTML;
      button.dataset.originalContent = originalContent;
      button.innerHTML = '<span class="sp-btn__spinner"></span>';
    } else {
      button.classList.remove('sp-btn--loading');
      button.disabled = false;

      // Restaurer le contenu original
      if (button.dataset.originalContent) {
        button.innerHTML = button.dataset.originalContent;
        delete button.dataset.originalContent;

        // Réinitialiser les icônes
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }
    }
  }

  /**
   * Active ou désactive un bouton
   *
   * @param {HTMLButtonElement} button - L'élément bouton
   * @param {boolean} isDisabled - État désactivé
   */
  static setDisabled(button, isDisabled) {
    if (!button) return;
    button.disabled = isDisabled;
  }
}

// Export pour utilisation en module ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Button;
}

// Export global
if (typeof window !== 'undefined') {
  window.Button = Button;
}
