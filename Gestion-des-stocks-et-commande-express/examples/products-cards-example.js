/**
 * EXEMPLE DE CODE - VUE PRODUITS EN CARTES
 *
 * Ce fichier montre l'implémentation de la vue produits avec :
 * - Vue tableau / vue cartes (toggle)
 * - Badges de statut colorés
 * - Actions rapides sur chaque carte
 * - Filtrage multi-critères
 * - Édition inline
 */

// ============================================================================
// COMPOSANT BADGE DE STATUT
// ============================================================================

class Badge {
  /**
   * Crée un badge de statut
   * @param {Object} options - Configuration du badge
   */
  static render(options) {
    const {
      status,
      text,
      icon = null,
      pulse = false
    } = options;

    const classes = [
      'sp-badge',
      `sp-badge--${status}`,
      pulse ? 'sp-badge--pulse' : ''
    ].filter(Boolean).join(' ');

    return `
      <span class="${classes}">
        ${icon ? `<i data-lucide="${icon}"></i>` : ''}
        ${text}
      </span>
    `;
  }

  /**
   * Calcule le statut du stock
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
}

// ============================================================================
// COMPOSANT CARTE PRODUIT
// ============================================================================

class ProductCard {
  /**
   * Crée une carte produit
   * @param {Object} product - Données du produit
   * @param {Object} handlers - Fonctions de callback
   */
  static render(product, handlers = {}) {
    const {
      id,
      reference,
      designation,
      image_url,
      stock_actuel,
      stock_minimum,
      prix_vente,
      categorie,
      fournisseur,
      etat_materiel
    } = product;

    const { onEdit, onDelete, onMovement, onClick } = handlers;

    // Statut du stock
    const stockStatus = Badge.getStockStatus(product);

    // Image par défaut si pas d'image
    const imageSrc = image_url || 'https://via.placeholder.com/300x200?text=Pas+d\'image';

    // Prix formaté
    const priceFormatted = parseFloat(prix_vente || 0).toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    });

    return `
      <div class="sp-product-card" data-product-id="${id}">
        <!-- Image -->
        <div class="sp-product-card__image" onclick="${onClick ? `productsModule.showProductDetail(${id})` : ''}">
          <img src="${imageSrc}" alt="${designation}">
          <div class="sp-product-card__badge">
            ${Badge.render(stockStatus)}
          </div>
        </div>

        <!-- Contenu -->
        <div class="sp-product-card__content">
          <!-- Header -->
          <div class="sp-product-card__header">
            <div class="sp-product-card__reference">${reference}</div>
            ${etat_materiel ? `
              <span class="sp-product-card__condition ${etat_materiel === 'neuf' ? 'sp-product-card__condition--new' : 'sp-product-card__condition--refurb'}">
                ${etat_materiel === 'neuf' ? 'Neuf' : 'Reconditionné'}
              </span>
            ` : ''}
          </div>

          <!-- Titre -->
          <h3 class="sp-product-card__title" title="${designation}">
            ${designation}
          </h3>

          <!-- Métadonnées -->
          <div class="sp-product-card__meta">
            ${categorie ? `
              <div class="sp-product-card__meta-item">
                <i data-lucide="tag"></i>
                <span>${categorie}</span>
              </div>
            ` : ''}
            ${fournisseur ? `
              <div class="sp-product-card__meta-item">
                <i data-lucide="truck"></i>
                <span>${fournisseur}</span>
              </div>
            ` : ''}
          </div>

          <!-- Stock -->
          <div class="sp-product-card__stock">
            <div class="sp-product-card__stock-info">
              <span class="sp-product-card__stock-label">Stock</span>
              <span class="sp-product-card__stock-value" data-editable="stock_actuel">
                ${stock_actuel}
              </span>
            </div>
            <div class="sp-product-card__stock-bar">
              <div class="sp-product-card__stock-progress" style="width: ${Math.min((stock_actuel / (stock_minimum * 2)) * 100, 100)}%"></div>
            </div>
            <div class="sp-product-card__stock-min">
              Min: ${stock_minimum || 0}
            </div>
          </div>

          <!-- Prix -->
          <div class="sp-product-card__price" data-editable="prix_vente">
            ${priceFormatted}
          </div>
        </div>

        <!-- Actions -->
        <div class="sp-product-card__actions">
          <button
            class="sp-btn sp-btn--sm sp-btn--outline"
            onclick="productsModule.showMovementModal(${id})"
            title="Enregistrer un mouvement">
            <i data-lucide="arrow-right-left"></i>
            Mouvement
          </button>
          <div class="sp-product-card__actions-group">
            <button
              class="sp-btn sp-btn--sm sp-btn--ghost sp-btn--icon-only"
              onclick="productsModule.editProduct(${id})"
              title="Modifier">
              <i data-lucide="edit-2"></i>
            </button>
            <button
              class="sp-btn sp-btn--sm sp-btn--ghost sp-btn--icon-only sp-btn--danger"
              onclick="productsModule.deleteProduct(${id})"
              title="Supprimer">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

// ============================================================================
// COMPOSANT FILTRES
// ============================================================================

class Filters {
  /**
   * Crée la barre de filtres
   */
  static render(options) {
    const {
      categories = [],
      suppliers = [],
      activeFilters = {}
    } = options;

    return `
      <div class="sp-filters">
        <!-- Recherche -->
        <div class="sp-filters__search">
          <i data-lucide="search"></i>
          <input
            type="text"
            placeholder="Rechercher par référence ou désignation..."
            id="filter-search"
            value="${activeFilters.search || ''}">
        </div>

        <!-- Filtres -->
        <div class="sp-filters__group">
          <!-- Catégorie -->
          <select id="filter-category" class="sp-filters__select">
            <option value="">Toutes les catégories</option>
            ${categories.map(cat => `
              <option value="${cat.nom}" ${activeFilters.category === cat.nom ? 'selected' : ''}>
                ${cat.nom}
              </option>
            `).join('')}
          </select>

          <!-- Fournisseur -->
          <select id="filter-supplier" class="sp-filters__select">
            <option value="">Tous les fournisseurs</option>
            ${suppliers.map(sup => `
              <option value="${sup.nom}" ${activeFilters.supplier === sup.nom ? 'selected' : ''}>
                ${sup.nom}
              </option>
            `).join('')}
          </select>

          <!-- Statut -->
          <select id="filter-status" class="sp-filters__select">
            <option value="">Tous les statuts</option>
            <option value="normal" ${activeFilters.status === 'normal' ? 'selected' : ''}>En stock</option>
            <option value="low" ${activeFilters.status === 'low' ? 'selected' : ''}>Stock bas</option>
            <option value="out" ${activeFilters.status === 'out' ? 'selected' : ''}>Rupture</option>
          </select>

          <!-- État -->
          <select id="filter-condition" class="sp-filters__select">
            <option value="">Tous les états</option>
            <option value="neuf" ${activeFilters.condition === 'neuf' ? 'selected' : ''}>Neuf</option>
            <option value="reconditionné" ${activeFilters.condition === 'reconditionné' ? 'selected' : ''}>Reconditionné</option>
          </select>

          <!-- Reset -->
          <button class="sp-btn sp-btn--ghost sp-btn--sm" id="btn-reset-filters">
            <i data-lucide="x"></i>
            Réinitialiser
          </button>
        </div>
      </div>
    `;
  }
}

// ============================================================================
// MODULE PRODUITS
// ============================================================================

class ProductsModule {
  constructor() {
    this.products = [];
    this.filteredProducts = [];
    this.currentView = 'grid'; // 'grid' ou 'table'
    this.activeFilters = {};
    this.categories = [];
    this.suppliers = [];
  }

  /**
   * Initialise le module produits
   */
  async init() {
    console.log('📦 Initialisation du module produits...');

    // Charger les données de référence
    await this.loadReferenceData();

    // Charger les produits
    await this.loadProducts();

    // Bind les événements
    this.bindEvents();

    console.log('✅ Module produits initialisé');
  }

  /**
   * Charge les catégories et fournisseurs
   */
  async loadReferenceData() {
    try {
      const response = await fetch('/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'sempa_stocks_reference_data',
          nonce: SempaStocksData.nonce
        })
      });

      const result = await response.json();
      if (result.success) {
        this.categories = result.data.categories || [];
        this.suppliers = result.data.suppliers || [];
      }
    } catch (error) {
      console.error('Erreur chargement données référence:', error);
    }
  }

  /**
   * Charge les produits
   */
  async loadProducts(filters = {}) {
    try {
      const response = await fetch('/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'sempa_stocks_products',
          nonce: SempaStocksData.nonce,
          ...filters
        })
      });

      const result = await response.json();
      if (result.success) {
        this.products = result.data || [];
        this.applyFilters();
      }
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      this.showNotification('Erreur lors du chargement des produits', 'error');
    }
  }

  /**
   * Applique les filtres
   */
  applyFilters() {
    let filtered = [...this.products];

    // Filtre recherche
    if (this.activeFilters.search) {
      const search = this.activeFilters.search.toLowerCase();
      filtered = filtered.filter(p =>
        (p.reference || '').toLowerCase().includes(search) ||
        (p.designation || '').toLowerCase().includes(search)
      );
    }

    // Filtre catégorie
    if (this.activeFilters.category) {
      filtered = filtered.filter(p => p.categorie === this.activeFilters.category);
    }

    // Filtre fournisseur
    if (this.activeFilters.supplier) {
      filtered = filtered.filter(p => p.fournisseur === this.activeFilters.supplier);
    }

    // Filtre statut
    if (this.activeFilters.status) {
      filtered = filtered.filter(p => {
        const status = Badge.getStockStatus(p).status;
        return (
          (this.activeFilters.status === 'normal' && status === 'success') ||
          (this.activeFilters.status === 'low' && status === 'warning') ||
          (this.activeFilters.status === 'out' && status === 'danger')
        );
      });
    }

    // Filtre état
    if (this.activeFilters.condition) {
      filtered = filtered.filter(p => p.etat_materiel === this.activeFilters.condition);
    }

    this.filteredProducts = filtered;
    this.render();
  }

  /**
   * Affiche les produits
   */
  render() {
    const container = document.getElementById('products-container');
    if (!container) return;

    // Afficher les filtres
    this.renderFilters();

    // Afficher header avec toggle vue et stats
    this.renderHeader();

    // Afficher les produits selon la vue
    if (this.currentView === 'grid') {
      this.renderGridView();
    } else {
      this.renderTableView();
    }

    // Initialiser les icônes Lucide
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  /**
   * Affiche les filtres
   */
  renderFilters() {
    const container = document.getElementById('products-filters');
    if (!container) return;

    container.innerHTML = Filters.render({
      categories: this.categories,
      suppliers: this.suppliers,
      activeFilters: this.activeFilters
    });
  }

  /**
   * Affiche le header
   */
  renderHeader() {
    const container = document.getElementById('products-header');
    if (!container) return;

    const total = this.filteredProducts.length;
    const allTotal = this.products.length;

    container.innerHTML = `
      <div class="products-header">
        <div class="products-header__info">
          <h2 class="products-header__title">Produits</h2>
          <span class="products-header__count">
            ${total === allTotal ? `${total} produits` : `${total} sur ${allTotal} produits`}
          </span>
        </div>
        <div class="products-header__actions">
          <!-- Toggle vue -->
          <div class="sp-view-toggle">
            <button
              class="sp-view-toggle__btn ${this.currentView === 'grid' ? 'sp-view-toggle__btn--active' : ''}"
              onclick="productsModule.setView('grid')">
              <i data-lucide="grid-3x3"></i>
            </button>
            <button
              class="sp-view-toggle__btn ${this.currentView === 'table' ? 'sp-view-toggle__btn--active' : ''}"
              onclick="productsModule.setView('table')">
              <i data-lucide="list"></i>
            </button>
          </div>

          <!-- Bouton ajouter -->
          <button class="sp-btn sp-btn--primary" onclick="productsModule.showAddProductModal()">
            <i data-lucide="plus"></i>
            Ajouter un produit
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Affiche la vue grille
   */
  renderGridView() {
    const container = document.getElementById('products-list');
    if (!container) return;

    if (this.filteredProducts.length === 0) {
      container.innerHTML = `
        <div class="sp-empty-state">
          <i data-lucide="package"></i>
          <p>Aucun produit trouvé</p>
        </div>
      `;
      return;
    }

    const html = `
      <div class="sp-products-grid">
        ${this.filteredProducts.map(product =>
          ProductCard.render(product, {
            onClick: () => this.showProductDetail(product.id),
            onEdit: () => this.editProduct(product.id),
            onDelete: () => this.deleteProduct(product.id),
            onMovement: () => this.showMovementModal(product.id)
          })
        ).join('')}
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Affiche la vue tableau
   */
  renderTableView() {
    const container = document.getElementById('products-list');
    if (!container) return;

    if (this.filteredProducts.length === 0) {
      container.innerHTML = `
        <div class="sp-empty-state">
          <i data-lucide="package"></i>
          <p>Aucun produit trouvé</p>
        </div>
      `;
      return;
    }

    const html = `
      <div class="sp-table-wrapper">
        <table class="sp-table">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation</th>
              <th>Catégorie</th>
              <th>Fournisseur</th>
              <th>Stock</th>
              <th>Prix</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.filteredProducts.map(product => {
              const stockStatus = Badge.getStockStatus(product);
              const priceFormatted = parseFloat(product.prix_vente || 0).toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR'
              });

              return `
                <tr data-product-id="${product.id}">
                  <td><strong>${product.reference}</strong></td>
                  <td>${product.designation}</td>
                  <td>${product.categorie || '-'}</td>
                  <td>${product.fournisseur || '-'}</td>
                  <td>
                    <span class="sp-stock-value ${product.stock_actuel <= product.stock_minimum ? 'sp-stock-value--low' : ''}">
                      ${product.stock_actuel}
                    </span>
                  </td>
                  <td>${priceFormatted}</td>
                  <td>${Badge.render(stockStatus)}</td>
                  <td>
                    <div class="sp-table-actions">
                      <button class="sp-btn sp-btn--sm sp-btn--ghost sp-btn--icon-only" onclick="productsModule.editProduct(${product.id})" title="Modifier">
                        <i data-lucide="edit-2"></i>
                      </button>
                      <button class="sp-btn sp-btn--sm sp-btn--ghost sp-btn--icon-only" onclick="productsModule.showMovementModal(${product.id})" title="Mouvement">
                        <i data-lucide="arrow-right-left"></i>
                      </button>
                      <button class="sp-btn sp-btn--sm sp-btn--ghost sp-btn--icon-only sp-btn--danger" onclick="productsModule.deleteProduct(${product.id})" title="Supprimer">
                        <i data-lucide="trash-2"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Change la vue
   */
  setView(view) {
    this.currentView = view;
    localStorage.setItem('products_view', view);
    this.render();
  }

  /**
   * Bind les événements
   */
  bindEvents() {
    // Recherche
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.activeFilters.search = e.target.value;
          this.applyFilters();
        }, 300);
      });
    }

    // Filtres
    ['category', 'supplier', 'status', 'condition'].forEach(filterType => {
      const select = document.getElementById(`filter-${filterType}`);
      if (select) {
        select.addEventListener('change', (e) => {
          this.activeFilters[filterType] = e.target.value;
          this.applyFilters();
        });
      }
    });

    // Reset filtres
    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.activeFilters = {};
        this.applyFilters();
      });
    }
  }

  /**
   * Affiche le modal d'ajout de produit
   */
  showAddProductModal() {
    console.log('Afficher modal ajout produit');
    // À implémenter avec le composant Modal
  }

  /**
   * Édite un produit
   */
  editProduct(productId) {
    console.log('Éditer produit:', productId);
    // À implémenter
  }

  /**
   * Supprime un produit
   */
  async deleteProduct(productId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      return;
    }

    try {
      const response = await fetch('/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'sempa_stocks_delete_product',
          nonce: SempaStocksData.nonce,
          id: productId
        })
      });

      const result = await response.json();
      if (result.success) {
        this.showNotification('Produit supprimé avec succès', 'success');
        await this.loadProducts();
      } else {
        throw new Error(result.data?.message || 'Erreur inconnue');
      }
    } catch (error) {
      console.error('Erreur suppression produit:', error);
      this.showNotification('Erreur lors de la suppression', 'error');
    }
  }

  /**
   * Affiche le modal de mouvement
   */
  showMovementModal(productId) {
    console.log('Afficher modal mouvement:', productId);
    // À implémenter
  }

  /**
   * Affiche le détail d'un produit
   */
  showProductDetail(productId) {
    console.log('Afficher détail produit:', productId);
    // À implémenter
  }

  /**
   * Affiche une notification
   */
  showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // À implémenter avec le composant Notification
  }
}

// ============================================================================
// INITIALISATION
// ============================================================================

// Créer instance globale
window.productsModule = new ProductsModule();

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.hash === '#view-products') {
    productsModule.init();
  }
});

// Gérer navigation SPA
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#view-products') {
    productsModule.init();
  }
});

// Export
export { ProductsModule, ProductCard, Badge, Filters };
