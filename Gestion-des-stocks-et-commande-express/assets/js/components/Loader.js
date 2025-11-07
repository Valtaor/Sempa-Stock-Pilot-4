/**
 * COMPOSANT LOADER
 *
 * Composant spinner de chargement
 */

class Loader {
  /**
   * Crée un loader/spinner
   *
   * @param {Object} options - Configuration du loader
   * @param {string} [options.size='md'] - Taille: 'sm', 'md', 'lg', 'xl'
   * @param {string} [options.color] - Couleur personnalisée (variable CSS ou hex)
   * @param {boolean} [options.fullscreen=false] - Afficher en plein écran
   * @param {string} [options.text] - Texte d'accompagnement
   * @param {string} [options.className] - Classes CSS additionnelles
   *
   * @returns {string} HTML du loader
   */
  static render(options = {}) {
    const {
      size = 'md',
      color = null,
      fullscreen = false,
      text = '',
      className = ''
    } = options;

    const classes = [
      'sp-loader',
      `sp-loader--${size}`
    ];

    if (fullscreen) {
      classes.push('sp-loader--fullscreen');
    }

    if (className) {
      classes.push(className);
    }

    const style = color ? `style="border-top-color: ${color}"` : '';

    const html = `
      <div class="${classes.join(' ')}">
        <div class="sp-loader__spinner" ${style}></div>
        ${text ? `<div class="sp-loader__text">${text}</div>` : ''}
      </div>
    `;

    return html;
  }

  /**
   * Crée un élément loader DOM
   *
   * @param {Object} options - Configuration du loader
   * @returns {HTMLDivElement} L'élément loader créé
   */
  static create(options = {}) {
    const html = this.render(options);
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  /**
   * Affiche un loader dans un conteneur
   *
   * @param {string|HTMLElement} container - Sélecteur ou élément conteneur
   * @param {Object} options - Configuration du loader
   * @returns {HTMLDivElement} L'élément loader créé
   */
  static show(container, options = {}) {
    const element = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!element) {
      console.error('Container not found:', container);
      return null;
    }

    const loader = this.create(options);
    element.appendChild(loader);
    return loader;
  }

  /**
   * Masque et supprime un loader
   *
   * @param {HTMLElement} loader - L'élément loader à supprimer
   */
  static hide(loader) {
    if (loader && loader.parentNode) {
      loader.remove();
    }
  }

  /**
   * Affiche un loader plein écran
   *
   * @param {Object} options - Configuration du loader
   * @returns {HTMLDivElement} L'élément loader créé
   */
  static showFullscreen(options = {}) {
    const loader = this.create({ ...options, fullscreen: true });
    document.body.appendChild(loader);
    return loader;
  }

  /**
   * Masque le loader plein écran
   */
  static hideFullscreen() {
    const loader = document.querySelector('.sp-loader--fullscreen');
    if (loader) {
      this.hide(loader);
    }
  }
}

// Export pour utilisation en module ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Loader;
}

// Export global
if (typeof window !== 'undefined') {
  window.Loader = Loader;
}
