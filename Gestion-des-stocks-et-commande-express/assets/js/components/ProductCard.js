/**
 * COMPOSANT PRODUCTCARD
 *
 * Carte produit moderne avec image, informations, badge statut et actions
 */

class ProductCard {
  /**
   * Crée une carte produit
   *
   * @param {Object} product - Données du produit
   * @param {string} product.id - ID du produit
   * @param {string} product.reference - Référence
   * @param {string} product.designation - Désignation
   * @param {string} product.categorie - Catégorie
   * @param {string} product.fournisseur - Fournisseur
   * @param {number} product.stock_actuel - Stock actuel
   * @param {number} product.stock_minimum - Stock minimum
   * @param {number} product.stock_maximum - Stock maximum
   * @param {number} product.prix_achat - Prix d'achat
   * @param {number} product.prix_vente - Prix de vente
   * @param {string} product.etat_materiel - État (neuf, reconditionné)
   * @param {string} product.emplacement - Emplacement
   * @param {string} product.document_url - URL du document
   * @param {Object} options - Options d'affichage
   * @param {Function} options.onEdit - Callback lors du clic sur éditer
   * @param {Function} options.onDuplicate - Callback lors du clic sur dupliquer
   * @param {Function} options.onDelete - Callback lors du clic sur supprimer
   * @returns {HTMLElement} - Élément DOM de la carte
   */
  static render(product, options = {}) {
    const {
      onEdit = null,
      onDuplicate = null,
      onDelete = null,
    } = options;

    // Calculer le statut du stock
    const stockStatus = this.getStockStatus(product);

    // Créer le conteneur de la carte
    const card = document.createElement('article');
    card.className = 'sp-product-card';
    card.setAttribute('data-product-id', product.id);
    card.setAttribute('data-status', stockStatus.variant);

    // Image ou placeholder
    const imageUrl = product.document_url && product.document_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      ? product.document_url
      : null;

    const imageHTML = imageUrl
      ? `<img src="${this.escapeHtml(imageUrl)}" alt="${this.escapeHtml(product.designation)}" loading="lazy" />`
      : `<div class="sp-product-card__placeholder">
          <i data-lucide="package"></i>
        </div>`;

    // Badge statut
    const badge = Badge.render({
      text: stockStatus.label,
      status: stockStatus.variant,
      pulse: stockStatus.variant === 'danger'
    });

    // Prix formatés
    const prixAchat = product.prix_achat ? parseFloat(product.prix_achat).toFixed(2) : '0.00';
    const prixVente = product.prix_vente ? parseFloat(product.prix_vente).toFixed(2) : '0.00';

    // Contenu HTML de la carte
    card.innerHTML = `
      <div class="sp-product-card__image">
        ${imageHTML}
        <div class="sp-product-card__badge">
          ${badge}
        </div>
      </div>

      <div class="sp-product-card__body">
        <div class="sp-product-card__header">
          <h3 class="sp-product-card__title" title="${this.escapeHtml(product.designation)}">
            ${this.escapeHtml(product.designation)}
          </h3>
          <p class="sp-product-card__reference">
            <i data-lucide="hash"></i>
            ${this.escapeHtml(product.reference)}
          </p>
        </div>

        <div class="sp-product-card__meta">
          ${product.categorie ? `
            <div class="sp-product-card__meta-item">
              <i data-lucide="folder"></i>
              <span>${this.escapeHtml(product.categorie)}</span>
            </div>
          ` : ''}

          ${product.fournisseur ? `
            <div class="sp-product-card__meta-item">
              <i data-lucide="truck"></i>
              <span>${this.escapeHtml(product.fournisseur)}</span>
            </div>
          ` : ''}

          ${product.emplacement ? `
            <div class="sp-product-card__meta-item">
              <i data-lucide="map-pin"></i>
              <span>${this.escapeHtml(product.emplacement)}</span>
            </div>
          ` : ''}
        </div>

        <div class="sp-product-card__stats">
          <div class="sp-product-card__stat">
            <span class="sp-product-card__stat-label">Stock</span>
            <span class="sp-product-card__stat-value sp-product-card__stat-value--${stockStatus.variant}">
              ${product.stock_actuel || 0}
            </span>
            ${product.stock_minimum ? `
              <span class="sp-product-card__stat-hint">Min: ${product.stock_minimum}</span>
            ` : ''}
          </div>

          <div class="sp-product-card__stat">
            <span class="sp-product-card__stat-label">Achat</span>
            <span class="sp-product-card__stat-value">${prixAchat} €</span>
          </div>

          <div class="sp-product-card__stat">
            <span class="sp-product-card__stat-label">Vente</span>
            <span class="sp-product-card__stat-value">${prixVente} €</span>
          </div>
        </div>
      </div>

      <div class="sp-product-card__footer">
        ${this.renderAuditTrail(product)}

        <div class="sp-product-card__actions">
          <button type="button" class="sp-product-card__action" data-action="edit" aria-label="Éditer le produit">
            <i data-lucide="edit-3"></i>
          </button>
          <button type="button" class="sp-product-card__action" data-action="duplicate" aria-label="Dupliquer le produit">
            <i data-lucide="copy"></i>
          </button>
          <button type="button" class="sp-product-card__action sp-product-card__action--danger" data-action="delete" aria-label="Supprimer le produit">
            <i data-lucide="trash-2"></i>
          </button>
        </div>

        ${product.document_url ? `
          <a href="${this.escapeHtml(product.document_url)}"
             class="sp-product-card__document"
             target="_blank"
             rel="noopener noreferrer"
             aria-label="Voir le document">
            <i data-lucide="file-text"></i>
          </a>
        ` : ''}
      </div>
    `;

    // Attacher les event listeners
    this.attachEventListeners(card, product, { onEdit, onDuplicate, onDelete });

    return card;
  }

  /**
   * Attache les event listeners aux boutons d'action
   *
   * @param {HTMLElement} card - Élément de la carte
   * @param {Object} product - Données du produit
   * @param {Object} callbacks - Callbacks pour les actions
   */
  static attachEventListeners(card, product, callbacks) {
    const { onEdit, onDuplicate, onDelete } = callbacks;

    // Bouton éditer
    const editBtn = card.querySelector('[data-action="edit"]');
    if (editBtn && onEdit) {
      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onEdit(product);
      });
    }

    // Bouton dupliquer
    const duplicateBtn = card.querySelector('[data-action="duplicate"]');
    if (duplicateBtn && onDuplicate) {
      duplicateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDuplicate(product);
      });
    }

    // Bouton supprimer
    const deleteBtn = card.querySelector('[data-action="delete"]');
    if (deleteBtn && onDelete) {
      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete(product);
      });
    }

    // Clic sur la carte entière pour éditer
    card.addEventListener('click', (e) => {
      // Ne pas déclencher si on a cliqué sur un bouton ou un lien
      if (e.target.closest('button, a')) {
        return;
      }
      if (onEdit) {
        onEdit(product);
      }
    });
  }

  /**
   * Génère le HTML pour l'audit trail (qui a modifié quand)
   *
   * @param {Object} product - Données du produit
   * @returns {string} - HTML de l'audit trail
   */
  static renderAuditTrail(product) {
    // Priorité : modified_at > created_at
    const modifiedAt = product.modified_at;
    const createdAt = product.created_at;
    const modifiedBy = product.modified_by;
    const createdBy = product.created_by;

    let auditHTML = '';

    if (modifiedAt && modifiedBy) {
      // Afficher "Modifié par X le Y"
      const date = new Date(modifiedAt);
      const dateStr = date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      auditHTML = `
        <div class="sp-product-card__audit">
          <i data-lucide="edit-2"></i>
          <span>Modifié le ${dateStr} à ${timeStr}</span>
        </div>
      `;
    } else if (createdAt && createdBy) {
      // Afficher "Créé par X le Y"
      const date = new Date(createdAt);
      const dateStr = date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      auditHTML = `
        <div class="sp-product-card__audit">
          <i data-lucide="plus-circle"></i>
          <span>Créé le ${dateStr} à ${timeStr}</span>
        </div>
      `;
    }

    return auditHTML;
  }

  /**
   * Détermine le statut du stock
   *
   * @param {Object} product - Données du produit
   * @returns {Object} - Statut avec variant et label
   */
  static getStockStatus(product) {
    const stock = parseInt(product.stock_actuel) || 0;
    const minimum = parseInt(product.stock_minimum) || 0;

    if (stock === 0) {
      return {
        variant: 'danger',
        label: 'Rupture'
      };
    }

    if (stock <= minimum) {
      return {
        variant: 'warning',
        label: 'Stock faible'
      };
    }

    return {
      variant: 'success',
      label: 'En stock'
    };
  }

  /**
   * Échappe les caractères HTML pour éviter les injections XSS
   *
   * @param {string} text - Texte à échapper
   * @returns {string} - Texte échappé
   */
  static escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Crée une grille de cartes produits
   *
   * @param {Array} products - Tableau de produits
   * @param {Object} options - Options d'affichage
   * @returns {HTMLElement} - Conteneur de la grille
   */
  static renderGrid(products, options = {}) {
    const grid = document.createElement('div');
    grid.className = 'sp-products-grid';

    if (!products || products.length === 0) {
      grid.innerHTML = `
        <div class="sp-empty-state">
          <i data-lucide="package-x"></i>
          <p>Aucun produit trouvé</p>
        </div>
      `;
      return grid;
    }

    products.forEach(product => {
      const card = this.render(product, options);
      grid.appendChild(card);
    });

    return grid;
  }
}

// Export pour utilisation en module ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductCard;
}
