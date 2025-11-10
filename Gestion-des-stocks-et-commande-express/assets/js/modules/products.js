/**
 * MODULE PRODUCTS
 *
 * Gère la vue produits avec affichage en grille de cartes,
 * filtres multi-critères, recherche et pagination
 */

class ProductsModule {
  constructor() {
    this.products = [];
    this.filteredProducts = [];
    this.currentPage = 1;
    this.perPage = 24;
    this.filters = {
      search: '',
      category: '',
      supplier: '',
      status: ''
    };
    this.currentViewType = localStorage.getItem('productsViewType') || 'grid'; // 'grid' ou 'table'
    this.initialized = false;
  }

  /**
   * Récupère le client API (attend l'initialisation si nécessaire)
   */
  async getApiClient() {
    console.log('🔍 ProductsModule - Tentative de récupération API...');

    if (window.api) {
      console.log('✅ window.api disponible immédiatement');
      return window.api;
    }

    console.log('⏳ window.api non disponible, essai waitForStockPilotAPI...');

    if (typeof window.waitForStockPilotAPI === 'function') {
      console.log('✅ waitForStockPilotAPI existe, appel en cours...');
      const api = await window.waitForStockPilotAPI();
      console.log('✅ API récupérée via waitForStockPilotAPI');
      return api;
    }

    if (window.stockpilotAPIReady && typeof window.stockpilotAPIReady.then === 'function') {
      console.log('✅ stockpilotAPIReady existe, attente...');
      const api = await window.stockpilotAPIReady;
      console.log('✅ API récupérée via stockpilotAPIReady');
      return api;
    }

    console.error('❌ Aucune méthode d\'initialisation API trouvée !');
    console.error('window.api:', window.api);
    console.error('window.waitForStockPilotAPI:', typeof window.waitForStockPilotAPI);
    console.error('window.stockpilotAPIReady:', window.stockpilotAPIReady);

    throw new Error('API StockPilot non initialisée');
  }

  /**
   * Initialise le module
   */
  async init() {
    if (this.initialized) {
      console.log('📦 Module Products déjà initialisé');
      return;
    }

    console.log('📦 Initialisation du module Products...');

    try {
      // Vérifier et réparer le conteneur si nécessaire
      this.ensureContainer();

      // Charger les produits
      await this.loadProducts();

      // Initialiser les event listeners
      this.initEventListeners();

      // Afficher les produits
      this.renderProducts();

      this.initialized = true;
      console.log('✅ Module Products initialisé');
    } catch (error) {
      console.error('❌ Erreur initialisation Products:', error);
      this.showError('Erreur lors du chargement des produits');
    }
  }

  /**
   * Vérifie que le conteneur existe (il doit toujours exister dans le HTML)
   */
  ensureContainer() {
    const container = document.getElementById('products-grid-container');

    if (container) {
      console.log('✅ Conteneur products-grid-container présent');
      return;
    }

    // Le conteneur devrait toujours exister dans le HTML (stocks.php ligne 340)
    // S'il n'existe pas, c'est une erreur critique
    console.error('❌ ERREUR CRITIQUE: Conteneur products-grid-container manquant du HTML !');
    console.error('❌ Vérifier stocks.php ligne 340 - le conteneur doit être présent');
  }

  /**
   * Charge les produits depuis l'API
   */
  async loadProducts() {
    console.log('🔄 Chargement des produits...');

    try {
      const apiClient = await this.getApiClient();
      const response = await apiClient.getProducts();
      this.products = response.products || [];
      this.applyFilters();

      // Remplir les selects de filtres
      this.populateFilterSelects();

      console.log(`✅ ${this.products.length} produits chargés`);
    } catch (error) {
      console.error('❌ Erreur chargement produits:', error);
      throw error;
    }
  }

  /**
   * Remplit les selects de filtres avec les catégories et fournisseurs
   */
  populateFilterSelects() {
    // Extraire les catégories uniques
    const categories = [...new Set(this.products.map(p => p.categorie).filter(Boolean))].sort();
    const categoryFilter = document.getElementById('stocks-filter-category');

    if (categoryFilter) {
      const currentValue = categoryFilter.value;
      categoryFilter.innerHTML = '<option value="">Toutes les catégories</option>';
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
      });
      if (currentValue) {
        categoryFilter.value = currentValue;
      }
    }

    // Extraire les fournisseurs uniques
    const suppliers = [...new Set(this.products.map(p => p.fournisseur).filter(Boolean))].sort();
    const supplierFilter = document.getElementById('stocks-filter-supplier');

    if (supplierFilter) {
      const currentValue = supplierFilter.value;
      supplierFilter.innerHTML = '<option value="">Tous les fournisseurs</option>';
      suppliers.forEach(sup => {
        const option = document.createElement('option');
        option.value = sup;
        option.textContent = sup;
        supplierFilter.appendChild(option);
      });
      if (currentValue) {
        supplierFilter.value = currentValue;
      }
    }

    console.log(`✅ Filtres peuplés: ${categories.length} catégories, ${suppliers.length} fournisseurs`);
  }

  /**
   * Initialise les event listeners
   */
  initEventListeners() {
    // Recherche
    const searchInput = document.getElementById('stocks-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value.trim().toLowerCase();
        this.currentPage = 1;
        this.applyFilters();
        this.renderProducts();
      });
    }

    // Filtre catégorie
    const categoryFilter = document.getElementById('stocks-filter-category');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.filters.category = e.target.value;
        this.currentPage = 1;
        this.applyFilters();
        this.renderProducts();
      });
    }

    // Filtre fournisseur
    const supplierFilter = document.getElementById('stocks-filter-supplier');
    if (supplierFilter) {
      supplierFilter.addEventListener('change', (e) => {
        this.filters.supplier = e.target.value;
        this.currentPage = 1;
        this.applyFilters();
        this.renderProducts();
      });
    }

    // Filtre statut
    const statusFilter = document.getElementById('stocks-filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.filters.status = e.target.value;
        this.currentPage = 1;
        this.applyFilters();
        this.renderProducts();
      });
    }

    // Bouton réinitialiser filtres
    const clearFiltersBtn = document.getElementById('stocks-clear-filters');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        this.clearFilters();
      });
    }

    // Bouton ajouter produit
    const addProductBtn = document.getElementById('stocks-open-product-form');
    if (addProductBtn) {
      addProductBtn.addEventListener('click', () => {
        this.openProductForm();
      });
    }

    // Boutons de fermeture du formulaire
    const closeFormBtn = document.getElementById('stocks-cancel-product');
    if (closeFormBtn) {
      closeFormBtn.addEventListener('click', () => {
        this.closeProductForm();
      });
    }

    const cancelFormBtn = document.querySelector('[data-dismiss="product"]');
    if (cancelFormBtn) {
      cancelFormBtn.addEventListener('click', () => {
        this.closeProductForm();
      });
    }

    // Pagination - produits par page
    const perPageSelect = document.getElementById('products-per-page');
    if (perPageSelect) {
      perPageSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        this.perPage = value === 'all' ? this.filteredProducts.length : parseInt(value);
        this.currentPage = 1;
        this.renderProducts();
      });
    }

    // Pagination - page précédente
    const prevPageBtn = document.getElementById('products-prev-page');
    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.renderProducts();
          this.scrollToTop();
        }
      });
    }

    // Pagination - page suivante
    const nextPageBtn = document.getElementById('products-next-page');
    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(this.filteredProducts.length / this.perPage);
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.renderProducts();
          this.scrollToTop();
        }
      });
    }

    // Toggle de vue (cartes/tableau)
    const viewToggleBtns = document.querySelectorAll('.view-toggle__btn');
    viewToggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const viewType = btn.getAttribute('data-view-type');
        this.switchViewType(viewType);
      });
    });

    // Appliquer la vue sauvegardée au démarrage (sans re-render)
    this.applyViewType(this.currentViewType);

    console.log('✅ Event listeners initialisés');
  }

  /**
   * Applique les filtres aux produits
   */
  applyFilters() {
    this.filteredProducts = this.products.filter(product => {
      // Filtre recherche
      if (this.filters.search) {
        const search = this.filters.search;
        const matchesSearch =
          (product.reference && product.reference.toLowerCase().includes(search)) ||
          (product.designation && product.designation.toLowerCase().includes(search)) ||
          (product.categorie && product.categorie.toLowerCase().includes(search)) ||
          (product.fournisseur && product.fournisseur.toLowerCase().includes(search));

        if (!matchesSearch) return false;
      }

      // Filtre catégorie
      if (this.filters.category && product.categorie !== this.filters.category) {
        return false;
      }

      // Filtre fournisseur
      if (this.filters.supplier && product.fournisseur !== this.filters.supplier) {
        return false;
      }

      // Filtre statut
      if (this.filters.status) {
        const stockStatus = ProductCard.getStockStatus(product);
        const statusMap = {
          'normal': 'success',
          'warning': 'warning',
          'critical': 'danger'
        };
        if (stockStatus.variant !== statusMap[this.filters.status]) {
          return false;
        }
      }

      return true;
    });

    console.log(`🔍 ${this.filteredProducts.length} produits après filtrage`);
  }

  /**
   * Affiche les produits (selon la vue active)
   */
  renderProducts() {
    console.log('🎨 Début renderProducts()');

    // Appeler la méthode appropriée selon la vue active
    if (this.currentViewType === 'table') {
      this.renderProductsTable();
    } else {
      this.renderProductsGrid();
    }
  }

  /**
   * Affiche les produits en mode grille (cartes)
   */
  renderProductsGrid() {
    console.log('🎨 Rendu des produits en mode grille');

    try {
      // Vérifier que le conteneur existe
      this.ensureContainer();

      const container = document.getElementById('products-grid-container');
      if (!container) {
        console.error('❌ Conteneur #products-grid-container non trouvé');
        return;
      }

      console.log('✅ Conteneur trouvé, affichage du loader...');

      // Afficher le loader et garder la référence
      const loader = Loader.show(container, {
        size: 'lg',
        text: 'Chargement des produits...'
      });

      // Calculer la pagination
      const startIndex = (this.currentPage - 1) * this.perPage;
      const endIndex = startIndex + this.perPage;
      const productsToShow = this.filteredProducts.slice(startIndex, endIndex);

      console.log(`📦 ${productsToShow.length} produits à afficher (page ${this.currentPage})`);

      // Créer la grille
      const grid = ProductCard.renderGrid(productsToShow, {
        onEdit: (product) => this.editProduct(product),
        onDuplicate: (product) => this.duplicateProduct(product),
        onDelete: (product) => this.deleteProduct(product)
      });

      console.log('✅ Grille créée:', grid);

      // Masquer le loader et afficher la grille
      setTimeout(() => {
        console.log('⏱️ Timeout déclenché, masquage du loader et affichage de la grille...');

        // Vérifier que le conteneur existe toujours
        const containerCheck = document.getElementById('products-grid-container');
        if (!containerCheck) {
          console.error('❌ Le conteneur a disparu pendant le timeout!');
          return;
        }

        // Masquer le loader correctement (passer le loader, pas le conteneur)
        if (loader) {
          Loader.hide(loader);
        }

        // Vider le conteneur et ajouter la grille
        containerCheck.innerHTML = '';
        containerCheck.appendChild(grid);

        console.log('✅ Grille ajoutée au DOM');

        // Initialiser les icônes Lucide
        if (window.lucide) {
          lucide.createIcons();
          console.log('✅ Icônes Lucide initialisées');
        }

        // Mettre à jour les infos de pagination
        this.updatePaginationInfo();
        console.log('✅ Pagination mise à jour');
      }, 300);
    } catch (error) {
      console.error('❌ Erreur dans renderProductsGrid():', error);
      this.showError('Erreur lors de l\'affichage des produits');
    }
  }

  /**
   * Met à jour les informations de pagination
   */
  updatePaginationInfo() {
    const totalPages = Math.ceil(this.filteredProducts.length / this.perPage);

    // Info nombre de résultats
    const countInfo = document.getElementById('products-count-info');
    if (countInfo) {
      const startIndex = (this.currentPage - 1) * this.perPage + 1;
      const endIndex = Math.min(startIndex + this.perPage - 1, this.filteredProducts.length);
      countInfo.textContent = `${startIndex}-${endIndex} sur ${this.filteredProducts.length} produits`;
    }

    // Info page actuelle
    const pageInfo = document.getElementById('products-page-info');
    if (pageInfo) {
      pageInfo.textContent = `Page ${this.currentPage} sur ${totalPages || 1}`;
    }

    // Bouton page précédente
    const prevBtn = document.getElementById('products-prev-page');
    if (prevBtn) {
      prevBtn.disabled = this.currentPage === 1;
    }

    // Bouton page suivante
    const nextBtn = document.getElementById('products-next-page');
    if (nextBtn) {
      nextBtn.disabled = this.currentPage >= totalPages;
    }
  }

  /**
   * Applique le type de vue sans re-render (pour l'initialisation)
   */
  applyViewType(viewType) {
    console.log(`✅ Application de la vue: ${viewType} (sans render)`);

    this.currentViewType = viewType;
    localStorage.setItem('productsViewType', viewType);

    // Mettre à jour les boutons toggle
    const toggleBtns = document.querySelectorAll('.view-toggle__btn');
    toggleBtns.forEach(btn => {
      const btnViewType = btn.getAttribute('data-view-type');
      if (btnViewType === viewType) {
        btn.classList.add('view-toggle__btn--active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('view-toggle__btn--active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    // Afficher/masquer les conteneurs avec classes CSS
    const gridContainer = document.getElementById('products-grid-container');
    const tableContainer = document.getElementById('products-table-container');

    if (viewType === 'grid') {
      if (gridContainer) gridContainer.classList.add('products-view--active');
      if (tableContainer) tableContainer.classList.remove('products-view--active');
    } else {
      if (gridContainer) gridContainer.classList.remove('products-view--active');
      if (tableContainer) tableContainer.classList.add('products-view--active');
    }

    console.log(`✅ Vue appliquée: ${viewType} (sans render)`);
  }

  /**
   * Bascule entre la vue grille et la vue tableau
   */
  switchViewType(viewType) {
    console.log(`🔄 Basculement vers vue ${viewType}`);

    this.currentViewType = viewType;
    localStorage.setItem('productsViewType', viewType);

    // Mettre à jour les boutons toggle
    const toggleBtns = document.querySelectorAll('.view-toggle__btn');
    toggleBtns.forEach(btn => {
      const btnViewType = btn.getAttribute('data-view-type');
      if (btnViewType === viewType) {
        btn.classList.add('view-toggle__btn--active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('view-toggle__btn--active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    // Afficher/masquer les conteneurs avec des CLASSES CSS (pas de style inline)
    const gridContainer = document.getElementById('products-grid-container');
    const tableContainer = document.getElementById('products-table-container');

    console.log('📊 État des conteneurs AVANT:', {
      gridExists: !!gridContainer,
      tableExists: !!tableContainer,
      gridHasActive: gridContainer ? gridContainer.classList.contains('products-view--active') : false,
      tableHasActive: tableContainer ? tableContainer.classList.contains('products-view--active') : false,
      gridDisplay: gridContainer ? window.getComputedStyle(gridContainer).display : 'N/A',
      tableDisplay: tableContainer ? window.getComputedStyle(tableContainer).display : 'N/A'
    });

    if (viewType === 'grid') {
      // Afficher la grille, masquer le tableau
      if (gridContainer) {
        gridContainer.classList.add('products-view--active');
      }
      if (tableContainer) {
        tableContainer.classList.remove('products-view--active');
      }
    } else {
      // Masquer la grille, afficher le tableau
      if (gridContainer) {
        gridContainer.classList.remove('products-view--active');
      }
      if (tableContainer) {
        tableContainer.classList.add('products-view--active');
      }
    }

    console.log('📊 État des conteneurs APRÈS:', {
      gridHasActive: gridContainer ? gridContainer.classList.contains('products-view--active') : false,
      tableHasActive: tableContainer ? tableContainer.classList.contains('products-view--active') : false,
      gridDisplay: gridContainer ? window.getComputedStyle(gridContainer).display : 'N/A',
      tableDisplay: tableContainer ? window.getComputedStyle(tableContainer).display : 'N/A',
      tableVisibility: tableContainer ? window.getComputedStyle(tableContainer).visibility : 'N/A',
      tableOpacity: tableContainer ? window.getComputedStyle(tableContainer).opacity : 'N/A',
      tableOffsetHeight: tableContainer ? tableContainer.offsetHeight : 'N/A'
    });

    // Re-render avec la nouvelle vue
    this.renderProducts();

    console.log(`✅ Vue basculée vers ${viewType}`);
  }

  /**
   * Affiche les produits en mode tableau
   */
  renderProductsTable() {
    console.log('🎨 Rendu des produits en mode tableau');

    const tbody = document.getElementById('products-table-body');
    if (!tbody) {
      console.error('❌ Tableau tbody non trouvé');
      return;
    }

    // Calculer la pagination
    const startIndex = (this.currentPage - 1) * this.perPage;
    const endIndex = startIndex + this.perPage;
    const productsToShow = this.filteredProducts.slice(startIndex, endIndex);

    // Vider le tableau
    tbody.innerHTML = '';

    if (productsToShow.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td colspan="9" class="empty">Aucun produit à afficher</td>';
      tbody.appendChild(emptyRow);
      return;
    }

    // Remplir le tableau
    productsToShow.forEach(product => {
      const row = document.createElement('tr');

      // Déterminer le statut du stock
      const stockActuel = parseInt(product.stock_actuel) || 0;
      const stockMin = parseInt(product.stock_minimum) || 0;
      let stockClass = '';
      if (stockActuel <= 0) {
        stockClass = 'stock-critical';
      } else if (stockActuel <= stockMin) {
        stockClass = 'stock-warning';
      }

      row.className = stockClass;
      row.innerHTML = `
        <td>${this.escapeHtml(product.reference || '')}</td>
        <td><strong>${this.escapeHtml(product.designation || '')}</strong></td>
        <td>${this.escapeHtml(product.categorie || '-')}</td>
        <td>${this.escapeHtml(product.fournisseur || '-')}</td>
        <td class="${stockClass}">${stockActuel}</td>
        <td>${product.prix_achat ? parseFloat(product.prix_achat).toFixed(2) + ' €' : '-'}</td>
        <td>${product.prix_vente ? parseFloat(product.prix_vente).toFixed(2) + ' €' : '-'}</td>
        <td><span class="badge badge--${product.etat_materiel === 'neuf' ? 'success' : 'info'}">${this.escapeHtml(product.etat_materiel || 'N/A')}</span></td>
        <td>
          <details class="actions-menu">
            <summary class="actions-menu__trigger" aria-label="Actions">
              <i data-lucide="more-horizontal"></i>
            </summary>
            <div class="actions-menu__content">
              <button data-action="edit" data-product-id="${product.id}">
                <i data-lucide="edit-2"></i>
                Modifier
              </button>
              <button data-action="duplicate" data-product-id="${product.id}">
                <i data-lucide="copy"></i>
                Dupliquer
              </button>
              <button data-action="delete" data-product-id="${product.id}" class="danger">
                <i data-lucide="trash-2"></i>
                Supprimer
              </button>
            </div>
          </details>
        </td>
      `;

      // Ajouter les event listeners pour les actions
      const editBtn = row.querySelector('[data-action="edit"]');
      const duplicateBtn = row.querySelector('[data-action="duplicate"]');
      const deleteBtn = row.querySelector('[data-action="delete"]');

      if (editBtn) {
        editBtn.addEventListener('click', () => this.editProduct(product));
      }
      if (duplicateBtn) {
        duplicateBtn.addEventListener('click', () => this.duplicateProduct(product));
      }
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => this.deleteProduct(product));
      }

      tbody.appendChild(row);
    });

    // Initialiser les icônes Lucide
    if (window.lucide) {
      lucide.createIcons();
    }

    // Mettre à jour la pagination
    this.updatePaginationInfo();

    console.log(`✅ ${productsToShow.length} produits affichés dans le tableau`);
  }

  /**
   * Échappe les caractères HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Réinitialise tous les filtres
   */
  clearFilters() {
    this.filters = {
      search: '',
      category: '',
      supplier: '',
      status: ''
    };

    // Réinitialiser les champs
    const searchInput = document.getElementById('stocks-search');
    if (searchInput) searchInput.value = '';

    const categoryFilter = document.getElementById('stocks-filter-category');
    if (categoryFilter) categoryFilter.value = '';

    const supplierFilter = document.getElementById('stocks-filter-supplier');
    if (supplierFilter) supplierFilter.value = '';

    const statusFilter = document.getElementById('stocks-filter-status');
    if (statusFilter) statusFilter.value = '';

    this.currentPage = 1;
    this.applyFilters();
    this.renderProducts();

    console.log('🔄 Filtres réinitialisés');
  }

  /**
   * Édite un produit
   */
  editProduct(product) {
    console.log('✏️ Éditer produit:', product.id);
    this.openProductForm(product);
  }

  /**
   * Duplique un produit
   */
  duplicateProduct(product) {
    console.log('📋 Dupliquer produit:', product.id);

    // Créer une copie sans l'ID pour créer un nouveau produit
    const duplicatedProduct = {
      ...product,
      id: null, // Pas d'ID = nouveau produit
      reference: `${product.reference}-COPIE`,
      designation: `${product.designation} (Copie)`
    };

    this.openProductForm(duplicatedProduct);
  }

  /**
   * Supprime un produit
   */
  async deleteProduct(product) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le produit "${product.designation}" ?`)) {
      return;
    }

    console.log('🗑️ Supprimer produit:', product.id);

    try {
      // TODO: Appeler l'API de suppression
      // const apiClient = await this.getApiClient();
      // await apiClient.deleteProduct(product.id);

      // Pour l'instant, simulation
      alert(`Produit "${product.designation}" supprimé avec succès\n(Simulation - Fonctionnalité à implémenter)`);

      // Recharger les produits
      await this.loadProducts();
      this.renderProducts();
    } catch (error) {
      console.error('❌ Erreur suppression produit:', error);
      alert('Erreur lors de la suppression du produit');
    }
  }

  /**
   * Ouvre le formulaire de produit (ajout ou édition)
   *
   * @param {Object|null} product - Produit à éditer, null pour nouveau produit
   */
  openProductForm(product = null) {
    console.log(product ? '✏️ Ouvrir formulaire édition' : '➕ Ouvrir formulaire ajout', product);

    const panel = document.getElementById('stocks-product-panel');
    const form = document.getElementById('stock-product-form');

    if (!panel || !form) {
      console.error('❌ Formulaire produit non trouvé dans le DOM');
      return;
    }

    // Charger les catégories et fournisseurs dans les selects
    this.populateFormSelects();

    // Réinitialiser le formulaire
    form.reset();

    // Si édition, pré-remplir les champs
    if (product && product.id) {
      console.log('📝 Pré-remplissage du formulaire avec:', product);

      // Champs texte et nombre
      const fields = {
        'id': product.id,
        'reference': product.reference,
        'designation': product.designation,
        'categorie': product.categorie,
        'fournisseur': product.fournisseur,
        'etat_materiel': product.etat_materiel,
        'prix_achat': product.prix_achat,
        'prix_vente': product.prix_vente,
        'stock_actuel': product.stock_actuel,
        'stock_minimum': product.stock_minimum,
        'stock_maximum': product.stock_maximum,
        'emplacement': product.emplacement,
        'date_entree': product.date_entree,
        'notes': product.notes
      };

      Object.keys(fields).forEach(fieldName => {
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (field && fields[fieldName] !== null && fields[fieldName] !== undefined) {
          field.value = fields[fieldName];
        }
      });

      // Changer le titre du formulaire
      const title = panel.querySelector('h2');
      if (title) {
        title.textContent = 'Modifier le produit';
      }
    } else if (product) {
      // Duplication : pré-remplir sans ID
      console.log('📋 Pré-remplissage pour duplication avec:', product);

      const fields = {
        'reference': product.reference,
        'designation': product.designation,
        'categorie': product.categorie,
        'fournisseur': product.fournisseur,
        'etat_materiel': product.etat_materiel,
        'prix_achat': product.prix_achat,
        'prix_vente': product.prix_vente,
        'stock_actuel': product.stock_actuel,
        'stock_minimum': product.stock_minimum,
        'stock_maximum': product.stock_maximum,
        'emplacement': product.emplacement,
        'notes': product.notes
      };

      Object.keys(fields).forEach(fieldName => {
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (field && fields[fieldName] !== null && fields[fieldName] !== undefined) {
          field.value = fields[fieldName];
        }
      });

      // Titre pour duplication
      const title = panel.querySelector('h2');
      if (title) {
        title.textContent = 'Dupliquer le produit';
      }
    } else {
      // Nouveau produit
      const title = panel.querySelector('h2');
      if (title) {
        title.textContent = 'Nouveau produit';
      }
    }

    // Afficher le panel
    panel.removeAttribute('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    console.log('✅ Formulaire produit ouvert');
  }

  /**
   * Ferme le formulaire de produit
   */
  closeProductForm() {
    const panel = document.getElementById('stocks-product-panel');
    if (panel) {
      panel.setAttribute('hidden', '');
      console.log('✅ Formulaire produit fermé');
    }
  }

  /**
   * Remplit les selects du formulaire avec les catégories et fournisseurs
   */
  populateFormSelects() {
    // Extraire les catégories uniques
    const categories = [...new Set(this.products.map(p => p.categorie).filter(Boolean))];
    const categorySelect = document.getElementById('stocks-category-select');

    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">Sélectionner une catégorie</option>';
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
      });
    }

    // Extraire les fournisseurs uniques
    const suppliers = [...new Set(this.products.map(p => p.fournisseur).filter(Boolean))];
    const supplierSelect = document.getElementById('stocks-supplier-select');

    if (supplierSelect) {
      supplierSelect.innerHTML = '<option value="">Sélectionner un fournisseur</option>';
      suppliers.forEach(sup => {
        const option = document.createElement('option');
        option.value = sup;
        option.textContent = sup;
        supplierSelect.appendChild(option);
      });
    }

    console.log(`✅ Selects peuplés: ${categories.length} catégories, ${suppliers.length} fournisseurs`);
  }

  /**
   * Scroll vers le haut de la liste
   */
  scrollToTop() {
    const container = document.getElementById('view-products');
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Affiche un message d'erreur
   */
  showError(message) {
    const container = document.getElementById('products-grid-container');
    if (container) {
      container.innerHTML = `
        <div class="sp-empty-state">
          <i data-lucide="alert-circle"></i>
          <p>${message}</p>
        </div>
      `;
      if (window.lucide) {
        lucide.createIcons();
      }
    }
  }

  /**
   * Rafraîchit les produits
   */
  async refresh() {
    console.log('🔄 Rafraîchissement des produits...');
    await this.loadProducts();
    this.renderProducts();
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    this.products = [];
    this.filteredProducts = [];
    this.initialized = false;
    console.log('🧹 Module Products nettoyé');
  }
}

// Créer une instance globale
window.productsModule = new ProductsModule();

// Export pour utilisation en module ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductsModule;
}
