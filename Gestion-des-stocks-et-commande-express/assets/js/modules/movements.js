/**
 * MODULE MOVEMENTS
 *
 * Gère l'affichage des mouvements de stock
 */

class MovementsModule {
  constructor() {
    this.movements = [];
    this.initialized = false;
  }

  /**
   * Initialise le module
   */
  async init() {
    if (this.initialized) {
      console.log('📦 Module Movements déjà initialisé');
      return;
    }

    console.log('📦 Initialisation du module Movements...');

    try {
      await this.loadMovements();
      this.setupEventListeners();
      this.initialized = true;
      console.log('✅ Module Movements initialisé');
    } catch (error) {
      console.error('❌ Erreur initialisation Movements:', error);
      this.showError('Erreur lors du chargement des mouvements');
    }
  }

  /**
   * Configure les écouteurs d'événements
   */
  setupEventListeners() {
    // Bouton Imprimer les mouvements - Afficher le formulaire de sélection de dates
    const printBtn = document.getElementById('stocks-print-movements');
    if (printBtn) {
      printBtn.addEventListener('click', () => this.showPrintFilters());
      console.log('✅ Handler Imprimer les mouvements configuré');
    }

    // Bouton confirmer l'impression
    const confirmPrintBtn = document.getElementById('movements-print-confirm');
    if (confirmPrintBtn) {
      confirmPrintBtn.addEventListener('click', () => this.printMovements());
      console.log('✅ Handler Confirmer impression configuré');
    }

    // Bouton annuler l'impression
    const cancelPrintBtn = document.getElementById('movements-print-cancel');
    if (cancelPrintBtn) {
      cancelPrintBtn.addEventListener('click', () => this.hidePrintFilters());
      console.log('✅ Handler Annuler impression configuré');
    }
  }

  /**
   * Affiche le formulaire de sélection de dates pour l'impression
   */
  showPrintFilters() {
    console.log('📅 Affichage du formulaire de sélection de dates');
    const filtersDiv = document.getElementById('movements-print-filters');
    if (filtersDiv) {
      filtersDiv.style.display = 'block';
    }
  }

  /**
   * Masque le formulaire de sélection de dates
   */
  hidePrintFilters() {
    console.log('❌ Masquage du formulaire de sélection de dates');
    const filtersDiv = document.getElementById('movements-print-filters');
    if (filtersDiv) {
      filtersDiv.style.display = 'none';
    }
  }

  /**
   * Imprime les mouvements avec sélection de période
   */
  async printMovements() {
    console.log('🖨️ Impression des mouvements...');

    // Lire les dates depuis les inputs HTML
    const startDateInput = document.getElementById('movements-start-date');
    const endDateInput = document.getElementById('movements-end-date');

    const startDateValue = startDateInput ? startDateInput.value : '';
    const endDateValue = endDateInput ? endDateInput.value : '';

    console.log('📅 Dates sélectionnées:', { start: startDateValue, end: endDateValue });

    // Filtrer les mouvements selon la période
    let filteredMovements = [...this.movements];

    if (startDateValue) {
      const start = new Date(startDateValue);
      start.setHours(0, 0, 0, 0);
      filteredMovements = filteredMovements.filter(m => new Date(m.date_mouvement) >= start);
    }

    if (endDateValue) {
      const end = new Date(endDateValue);
      end.setHours(23, 59, 59, 999);
      filteredMovements = filteredMovements.filter(m => new Date(m.date_mouvement) <= end);
    }

    console.log(`📊 ${filteredMovements.length} mouvements à imprimer`);

    // Masquer le formulaire de sélection
    this.hidePrintFilters();

    // Formater les dates pour l'affichage
    const startDateFormatted = startDateValue ? new Date(startDateValue).toLocaleDateString('fr-FR') : '';
    const endDateFormatted = endDateValue ? new Date(endDateValue).toLocaleDateString('fr-FR') : '';

    // Générer le contenu imprimable
    this.generatePrintableReport(filteredMovements, startDateFormatted, endDateFormatted);
  }

  /**
   * Génère un rapport imprimable des mouvements
   */
  generatePrintableReport(movements, startDate, endDate) {
    // Créer une fenêtre d'impression
    const printWindow = window.open('', '_blank');

    const periodText = startDate && endDate
      ? `du ${startDate} au ${endDate}`
      : startDate
        ? `à partir du ${startDate}`
        : endDate
          ? `jusqu'au ${endDate}`
          : 'Tous les mouvements';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Mouvements de stock SEMPA - ${periodText}</title>
        <style>
          @page { margin: 2cm; }
          body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
          }
          .header img {
            height: 60px;
            margin-bottom: 15px;
          }
          .header h1 {
            margin: 10px 0;
            font-size: 20px;
          }
          .header p {
            margin: 5px 0;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          .entree { color: #16a34a; font-weight: bold; }
          .sortie { color: #dc2626; font-weight: bold; }
          .ajustement { color: #ea580c; font-weight: bold; }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="https://sempa.fr/wp-content/uploads/2021/05/logo-since.svg" alt="Logo SEMPA">
          <h1>Rapport de mouvements de stock</h1>
          <p><strong>Période:</strong> ${periodText}</p>
          <p><strong>Date d'édition:</strong> ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
          <p><strong>Nombre de mouvements:</strong> ${movements.length}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Produit</th>
              <th>Référence</th>
              <th>Type</th>
              <th>Quantité</th>
              <th>Stock après</th>
              <th>Motif</th>
            </tr>
          </thead>
          <tbody>
            ${movements.map(m => {
              const date = new Date(m.date_mouvement);
              const dateStr = date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              const typeClass = {
                'entree': 'entree',
                'sortie': 'sortie',
                'ajustement': 'ajustement'
              }[m.type_mouvement] || '';

              const typeLabel = {
                'entree': 'Entrée',
                'sortie': 'Sortie',
                'ajustement': 'Ajustement'
              }[m.type_mouvement] || m.type_mouvement;

              return `
                <tr>
                  <td>${dateStr}</td>
                  <td>${this.escapeHtml(m.produit_designation || '-')}</td>
                  <td>${this.escapeHtml(m.produit_reference || '-')}</td>
                  <td class="${typeClass}">${typeLabel}</td>
                  <td><strong>${m.quantite}</strong></td>
                  <td>${m.stock_apres || '-'}</td>
                  <td>${this.escapeHtml(m.motif || '-')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Document généré par StockPilot - SEMPA © ${new Date().getFullYear()}</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    console.log(`✅ Rapport d'impression généré (${movements.length} mouvements)`);
  }

  /**
   * Charge les mouvements depuis l'API
   */
  async loadMovements() {
    console.log('🔄 Chargement des mouvements...');

    try {
      const apiClient = await this.getApiClient();
      const response = await apiClient.getMovements();
      this.movements = response.movements || [];

      console.log(`✅ ${this.movements.length} mouvements chargés`);

      this.renderMovements();
    } catch (error) {
      console.error('❌ Erreur chargement mouvements:', error);
      this.showError('Erreur lors du chargement des mouvements');
    }
  }

  /**
   * Récupère le client API (attend l'initialisation si nécessaire)
   */
  async getApiClient() {
    console.log('🔍 MovementsModule - Tentative de récupération API...');

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
   * Affiche les mouvements dans le tableau
   */
  renderMovements() {
    const tbody = document.querySelector('#stocks-movements-table tbody');

    if (!tbody) {
      console.error('❌ Tableau des mouvements non trouvé');
      return;
    }

    if (this.movements.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty">Aucun mouvement enregistré</td>
        </tr>
      `;
      return;
    }

    // Trier par date décroissante
    const sortedMovements = [...this.movements].sort((a, b) => {
      return new Date(b.date_mouvement) - new Date(a.date_mouvement);
    });

    tbody.innerHTML = sortedMovements.map(movement => {
      const date = new Date(movement.date_mouvement);
      const dateStr = date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const typeClass = {
        'entree': 'movement-chip--entry',
        'sortie': 'movement-chip--exit',
        'ajustement': 'movement-chip--adjust'
      }[movement.type_mouvement] || '';

      const typeLabel = {
        'entree': 'Entrée',
        'sortie': 'Sortie',
        'ajustement': 'Ajustement'
      }[movement.type_mouvement] || movement.type_mouvement;

      return `
        <tr>
          <td>${dateStr}</td>
          <td>
            <div class="product-cell">
              <span class="product-cell__name">${this.escapeHtml(movement.produit_designation || '')}</span>
              <span class="product-cell__meta">${this.escapeHtml(movement.produit_reference || '')}</span>
            </div>
          </td>
          <td>
            <span class="movement-chip ${typeClass}">${typeLabel}</span>
          </td>
          <td><strong>${movement.quantite}</strong></td>
          <td>${movement.stock_apres || '-'}</td>
          <td>${this.escapeHtml(movement.motif || '-')}</td>
        </tr>
      `;
    }).join('');

    console.log(`✅ ${this.movements.length} mouvements affichés`);
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
   * Affiche un message d'erreur
   */
  showError(message) {
    const tbody = document.querySelector('#stocks-movements-table tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty" style="color: #dc2626;">
            ${message}
          </td>
        </tr>
      `;
    }
  }

  /**
   * Rafraîchit les mouvements
   */
  async refresh() {
    console.log('🔄 Rafraîchissement des mouvements...');
    await this.loadMovements();
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    this.movements = [];
    this.initialized = false;
    console.log('🧹 Module Movements nettoyé');
  }
}

// Créer une instance globale
window.movementsModule = new MovementsModule();

// Export pour utilisation en module ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MovementsModule;
}