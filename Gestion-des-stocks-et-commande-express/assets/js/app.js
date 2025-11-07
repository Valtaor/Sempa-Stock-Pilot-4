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

      // Initialiser TOUS les modules dès le départ
      // pour que les event listeners soient attachés même dans les vues cachées
      await this.initDashboard();
      await this.initProducts();
      await this.initMovements();
      this.initCSVImport();

      this.initialized = true;
      console.log('✅ StockPilot initialisé avec succès');
    } catch (error) {
      console.error('❌ Erreur initialisation StockPilot:', error);
    }
  }

  /**
   * Initialise le module d'importation CSV
   */
  initCSVImport() {
    if (!window.importCSVModule) {
      console.warn('⚠️ Module import CSV non disponible');
      return;
    }

    try {
      window.importCSVModule.init();
      console.log('✅ Module import CSV initialisé');
    } catch (error) {
      console.error('❌ Erreur initialisation import CSV:', error);
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
   * Note: Les modules sont déjà initialisés au démarrage,
   * cette méthode sert juste à rafraîchir les données si nécessaire
   *
   * @param {string} viewName - Nom de la vue
   */
  async initModuleForView(viewName) {
    switch (viewName) {
      case 'dashboard':
        // Dashboard déjà initialisé - ne rien faire
        console.log('✅ Vue dashboard affichée');
        break;
      case 'products':
        // Products déjà initialisé - rafraîchir si nécessaire
        if (window.productsModule && window.productsModule.initialized) {
          console.log('✅ Vue produits affichée - rafraîchissement...');
          window.productsModule.renderProducts();
        }
        break;
      case 'movements':
        // Movements déjà initialisé - rafraîchir si nécessaire
        if (window.movementsModule && window.movementsModule.initialized && window.movementsModule.refresh) {
          console.log('✅ Vue mouvements affichée - rafraîchissement...');
          await window.movementsModule.refresh();
        }
        break;
      case 'reports':
        console.log('✅ Vue rapports affichée');
        break;
      case 'settings':
        console.log('✅ Vue paramètres affichée');
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