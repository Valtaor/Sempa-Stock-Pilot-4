/**
 * STOCKPILOT APP
 *
 * Point d'entrée principal de l'application StockPilot
 * Initialise les modules selon la vue active
 */

class StockPilotApp {
  constructor() {
    this.currentView = 'dashboard';
    this.initialized = false;
  }

  /**
   * Initialise l'application
   */
  async init() {
    if (this.initialized) {
      console.log('📦 StockPilot déjà initialisé');
      return;
    }

    console.log('📦 Initialisation de StockPilot...');

    try {
      // Initialiser les icônes Lucide
      this.initLucideIcons();

      // Initialiser la navigation entre vues
      this.initNavigation();

      // Afficher la vue par défaut (dashboard) et cacher les autres
      this.initializeViews();

      // Initialiser le module dashboard
      await this.initDashboard();

      // Initialiser le bouton d'import CSV
      this.initCSVImport();

      this.initialized = true;
      console.log('✅ StockPilot initialisé avec succès');
    } catch (error) {
      console.error('❌ Erreur initialisation StockPilot:', error);
    }
  }

  /**
   * Initialise le bouton d'importation CSV
   */
  initCSVImport() {
    const importButton = document.getElementById('stocks-import-csv');
    const fileInput = document.getElementById('csv-file-input');

    if (!importButton || !fileInput) {
      console.warn('⚠️ Bouton d\'import CSV non trouvé');
      return;
    }

    // Déclencher le sélecteur de fichier
    importButton.addEventListener('click', () => {
      fileInput.click();
    });

    // Gérer la sélection de fichier
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];

      if (!file) {
        return;
      }

      if (!file.name.endsWith('.csv')) {
        alert('Veuillez sélectionner un fichier CSV valide');
        fileInput.value = '';
        return;
      }

      try {
        await this.importCSV(file);
      } catch (error) {
        console.error('❌ Erreur lors de l\'import CSV:', error);
        alert('Erreur lors de l\'import du fichier CSV: ' + error.message);
      } finally {
        fileInput.value = '';
      }
    });

    console.log('✅ Import CSV initialisé');
  }

  /**
   * Importe un fichier CSV
   */
  async importCSV(file) {
    console.log('📥 Import du fichier CSV:', file.name);

    // Lire le fichier
    const text = await this.readFileAsText(file);

    // Parser le CSV
    const products = this.parseCSV(text);

    if (products.length === 0) {
      alert('Aucun produit trouvé dans le fichier CSV');
      return;
    }

    const confirmed = confirm(
      `Vous êtes sur le point d'importer ${products.length} produit(s).\n\n` +
      'Les produits existants (même référence) seront mis à jour.\n' +
      'Les nouveaux produits seront ajoutés.\n\n' +
      'Continuer ?'
    );

    if (!confirmed) {
      return;
    }

    // Afficher une barre de progression
    const progressDiv = this.showProgressBar();

    try {
      let success = 0;
      let errors = 0;

      // Importer les produits un par un
      for (let i = 0; i < products.length; i++) {
        const product = products[i];

        this.updateProgressBar(progressDiv, i + 1, products.length);

        try {
          // Vérifier si le produit existe déjà
          const existingProducts = await window.api.getProducts();
          const existing = existingProducts.products.find(
            p => p.reference === product.reference
          );

          if (existing) {
            // Mettre à jour le produit existant
            product.id = existing.id;
          }

          await window.api.saveProduct(product);
          success++;
        } catch (error) {
          console.error('❌ Erreur import produit:', product.reference, error);
          errors++;
        }
      }

      this.hideProgressBar(progressDiv);

      alert(
        `Import terminé !\n\n` +
        `✅ ${success} produit(s) importé(s)\n` +
        (errors > 0 ? `❌ ${errors} erreur(s)` : '')
      );

      // Rafraîchir la liste des produits si on est sur la vue produits
      if (this.currentView === 'products' && window.productsModule) {
        await window.productsModule.refresh();
      }

      console.log(`✅ Import CSV terminé: ${success} succès, ${errors} erreurs`);
    } catch (error) {
      this.hideProgressBar(progressDiv);
      throw error;
    }
  }

  /**
   * Lit un fichier comme texte
   */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        resolve(e.target.result);
      };

      reader.onerror = (e) => {
        reject(new Error('Erreur lors de la lecture du fichier'));
      };

      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * Parse un fichier CSV
   */
  parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return [];
    }

    // Première ligne = en-têtes
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'));

    // Mapper les en-têtes vers les champs attendus
    const headerMap = {
      'ID': 'id',
      'Référence': 'reference',
      'Désignation': 'designation',
      'Catégorie': 'categorie',
      'Fournisseur': 'fournisseur',
      'Prix achat': 'prix_achat',
      'Prix vente': 'prix_vente',
      'Stock actuel': 'stock_actuel',
      'Stock minimum': 'stock_minimum',
      'Stock maximum': 'stock_maximum',
      'Emplacement': 'emplacement',
      'Date entrée': 'date_entree',
      'Notes': 'notes'
    };

    const products = [];

    // Parser chaque ligne (sauter la première)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = this.parseCSVLine(line);

      if (values.length !== headers.length) {
        console.warn('⚠️ Ligne ignorée (nombre de colonnes incorrect):', i + 1);
        continue;
      }

      const product = {};
      let hasReference = false;

      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const field = headerMap[header] || header.toLowerCase().replace(/ /g, '_');
        const value = values[j].trim();

        if (field === 'reference' && value) {
          hasReference = true;
        }

        // Convertir les types
        if (['prix_achat', 'prix_vente'].includes(field)) {
          product[field] = value ? parseFloat(value.replace(',', '.')) : 0;
        } else if (['stock_actuel', 'stock_minimum', 'stock_maximum'].includes(field)) {
          product[field] = value ? parseInt(value, 10) : 0;
        } else {
          product[field] = value;
        }
      }

      // Ignorer les lignes sans référence
      if (hasReference && product.reference) {
        products.push(product);
      }
    }

    return products;
  }

  /**
   * Parse une ligne CSV en tenant compte des guillemets
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);

    return values.map(v => v.replace(/^"(.*)"$/, '$1'));
  }

  /**
   * Affiche une barre de progression
   */
  showProgressBar() {
    const progressDiv = document.createElement('div');
    progressDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      z-index: 10000;
      min-width: 300px;
      text-align: center;
    `;

    progressDiv.innerHTML = `
      <h3 style="margin: 0 0 20px; color: #1f2937;">Import en cours...</h3>
      <div style="background: #e5e7eb; height: 24px; border-radius: 12px; overflow: hidden;">
        <div id="progress-bar" style="background: #f4a412; height: 100%; width: 0%; transition: width 0.3s;"></div>
      </div>
      <p id="progress-text" style="margin: 10px 0 0; color: #6b7280; font-size: 14px;">0 / 0</p>
    `;

    document.body.appendChild(progressDiv);

    return progressDiv;
  }

  /**
   * Met à jour la barre de progression
   */
  updateProgressBar(progressDiv, current, total) {
    const bar = progressDiv.querySelector('#progress-bar');
    const text = progressDiv.querySelector('#progress-text');

    if (bar && text) {
      const percent = Math.round((current / total) * 100);
      bar.style.width = percent + '%';
      text.textContent = `${current} / ${total}`;
    }
  }

  /**
   * Masque la barre de progression
   */
  hideProgressBar(progressDiv) {
    if (progressDiv && progressDiv.parentNode) {
      progressDiv.parentNode.removeChild(progressDiv);
    }
  }

  /**
   * Initialise l'affichage des vues (affiche dashboard, cache les autres)
   */
  initializeViews() {
    const allViews = document.querySelectorAll('.main-view');
    allViews.forEach(view => {
      if (view.id === 'view-dashboard') {
        view.style.display = 'flex';
        view.classList.add('view-active');
      } else {
        view.style.display = 'none';
        view.classList.remove('view-active');
      }
    });
    console.log('✅ Vues initialisées (dashboard visible)');
  }

  /**
   * Initialise les icônes Lucide
   */
  initLucideIcons() {
    if (window.lucide) {
      lucide.createIcons();
      console.log('✅ Icônes Lucide initialisées');
    } else {
      console.warn('⚠️ Lucide Icons non disponible');
    }
  }

  /**
   * Initialise la navigation entre vues
   */
  initNavigation() {
    const navLinks = document.querySelectorAll('[data-view]');

    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Écouter les changements d'ancre (fallback pour support ancres HTML natives)
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash;
      if (hash.startsWith('#view-')) {
        const viewName = hash.replace('#view-', '');
        this.switchView(viewName);
      }
    });

    // Gérer l'ancre initiale dans l'URL
    if (window.location.hash.startsWith('#view-')) {
      const initialView = window.location.hash.replace('#view-', '');
      if (initialView) {
        this.switchView(initialView);
      }
    }

    console.log('✅ Navigation initialisée');
  }

  /**
   * Change de vue
   *
   * @param {string} viewName - Nom de la vue (dashboard, products, movements, etc.)
   */
  switchView(viewName) {
    console.log(`🔄 Changement de vue: ${viewName}`);

    // Fade out toutes les vues
    const allViews = document.querySelectorAll('.main-view');
    allViews.forEach(view => {
      view.classList.remove('view-active');
      // Attendre la fin de l'animation avant de cacher
      setTimeout(() => {
        if (!view.classList.contains('view-active')) {
          view.style.display = 'none';
        }
      }, 300);
    });

    // Afficher et fade in la vue demandée
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
      targetView.style.display = 'flex';
      // Force reflow pour que la transition fonctionne
      targetView.offsetHeight;
      targetView.classList.add('view-active');

      // Scroll vers le haut de la page principale
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Mettre à jour la navigation active
    const navLinks = document.querySelectorAll('[data-view]');
    navLinks.forEach(link => {
      if (link.getAttribute('data-view') === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Mettre à jour le header dynamique
    this.updateHeader(viewName);

    // Mettre à jour l'état actuel
    this.currentView = viewName;

    // Initialiser le module correspondant si nécessaire
    this.initModuleForView(viewName);
  }

  /**
   * Met à jour le header selon la vue active
   *
   * @param {string} viewName - Nom de la vue
   */
  updateHeader(viewName) {
    const headerConfig = {
      dashboard: {
        eyebrow: 'Vue d\'ensemble',
        title: 'Tableau de bord',
        subtitle: 'Suivez vos produits, alertes et mouvements dans une interface professionnelle.'
      },
      products: {
        eyebrow: 'Catalogue',
        title: 'Gestion des produits',
        subtitle: 'Gérez vos références, fournisseurs et niveaux de stock.'
      },
      movements: {
        eyebrow: 'Suivi des flux',
        title: 'Historique des mouvements',
        subtitle: 'Analysez les entrées, sorties et ajustements récents.'
      },
      reports: {
        eyebrow: 'Pilotage',
        title: 'Rapports & documents',
        subtitle: 'Exportez vos données et accédez aux ressources partagées.'
      },
      settings: {
        eyebrow: 'Automations',
        title: 'Raccourcis d\'administration',
        subtitle: 'Activez les fonctionnalités clés de StockPilot pour gagner du temps.'
      }
    };

    const config = headerConfig[viewName];
    if (!config) return;

    // Mettre à jour les éléments du header
    const eyebrow = document.querySelector('.stockpilot-header__eyebrow');
    const title = document.querySelector('.stockpilot-header__titles h1');
    const subtitle = document.querySelector('.stockpilot-header__subtitle');

    if (eyebrow) eyebrow.textContent = config.eyebrow;
    if (title) title.textContent = config.title;
    if (subtitle) subtitle.textContent = config.subtitle;
  }

  /**
   * Initialise le module correspondant à la vue
   *
   * @param {string} viewName - Nom de la vue
   */
  async initModuleForView(viewName) {
    switch (viewName) {
      case 'dashboard':
        await this.initDashboard();
        break;
      case 'products':
        await this.initProducts();
        break;
      case 'movements':
        await this.initMovements();
        break;
      case 'reports':
        console.log('✅ Vue rapports affichée (module à implémenter ultérieurement)');
        // Le HTML de la vue existe dans stocks.php, on l'affiche juste
        break;
      case 'settings':
        console.log('✅ Vue paramètres affichée (module à implémenter ultérieurement)');
        // Le HTML de la vue existe dans stocks.php, on l'affiche juste
        break;
    }
  }

  /**
   * Initialise le module dashboard
   */
  async initDashboard() {
    if (!window.dashboard) {
      console.error('❌ Module dashboard non disponible');
      return;
    }

    try {
      await window.dashboard.init();
      console.log('✅ Dashboard initialisé');
    } catch (error) {
      console.error('❌ Erreur initialisation dashboard:', error);
    }
  }

  /**
   * Initialise le module products
   */
  async initProducts() {
    if (!window.productsModule) {
      console.error('❌ Module products non disponible');
      return;
    }

    try {
      // Si déjà initialisé, vérifier le conteneur et afficher les produits
      if (window.productsModule.initialized) {
        console.log('📦 Module Products déjà initialisé, affichage des produits...');
        // Vérifier et réparer le conteneur si nécessaire
        window.productsModule.ensureContainer();
        window.productsModule.renderProducts();
        return;
      }

      // Sinon, initialiser complètement
      await window.productsModule.init();
      console.log('✅ Module Products initialisé');
    } catch (error) {
      console.error('❌ Erreur initialisation products:', error);
    }
  }

  /**
   * Initialise le module movements
   */
  async initMovements() {
    if (!window.movementsModule) {
      console.error('❌ Module movements non disponible');
      return;
    }

    try {
      if (window.movementsModule.initialized) {
        console.log('📦 Module Movements déjà initialisé, rafraîchissement...');
        await window.movementsModule.refresh();
        return;
      }

      await window.movementsModule.init();
      console.log('✅ Module Movements initialisé');
    } catch (error) {
      console.error('❌ Erreur initialisation movements:', error);
    }
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Nettoyer le dashboard
    if (window.dashboard && window.dashboard.destroy) {
      window.dashboard.destroy();
    }

    this.initialized = false;
    console.log('🧹 StockPilot nettoyé');
  }
}

// Initialiser l'application au chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.stockpilot = new StockPilotApp();
    window.stockpilot.init();
  });
} else {
  window.stockpilot = new StockPilotApp();
  window.stockpilot.init();
}

// Export pour utilisation en module ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StockPilotApp;
}