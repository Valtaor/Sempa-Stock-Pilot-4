/**
 * MODULE IMPORT CSV
 *
 * Gère l'import de produits depuis un fichier CSV
 */

class ImportCSVModule {
  constructor() {
    this.panel = null;
    this.dropZone = null;
    this.fileInput = null;
    this.parsedData = null;
    this.initialized = false;
    console.log('🏗️ ImportCSVModule constructor appelé');
  }

  /**
   * Initialise le module
   */
  init() {
    if (this.initialized) {
      console.log('📦 Module ImportCSV déjà initialisé');
      return;
    }

    console.log('📦 Initialisation du module ImportCSV...');

    this.panel = document.getElementById('stocks-import-panel');
    this.dropZone = document.getElementById('csv-drop-zone');
    this.fileInput = document.getElementById('csv-file-input');
    this.openButton = document.getElementById('stocks-import-csv');

    console.log('🔍 Éléments trouvés:', {
      panel: !!this.panel,
      dropZone: !!this.dropZone,
      fileInput: !!this.fileInput,
      openButton: !!this.openButton
    });

    if (!this.panel || !this.dropZone || !this.fileInput) {
      console.error('❌ Éléments du module ImportCSV non trouvés');
      return;
    }

    this.attachEventListeners();
    this.initialized = true;
    console.log('✅ Module ImportCSV initialisé');
  }

  /**
   * Attache les event listeners
   */
  attachEventListeners() {
    console.log('🔗 Attachement des event listeners pour import CSV...');

    // Bouton ouvrir - Attacher directement sur le bouton
    if (this.openButton) {
      this.openButton.addEventListener('click', (e) => {
        console.log('📥 Bouton import CSV cliqué (listener direct)', {
          button: this.openButton,
          buttonId: this.openButton.id,
          viewParent: this.openButton.closest('.main-view')?.id,
          viewActive: this.openButton.closest('.main-view')?.classList.contains('view-active'),
          computedPointerEvents: window.getComputedStyle(this.openButton).pointerEvents
        });
        e.preventDefault();
        e.stopPropagation();
        this.open();
      });
      console.log('✅ Event listener attaché directement sur le bouton');
    } else {
      console.warn('⚠️ Bouton import CSV non trouvé, impossible d\'attacher l\'event listener');
    }

    // Bouton ouvrir - Event delegation comme backup
    document.addEventListener('click', (e) => {
      const target = this.getEventTargetElement(e);
      if (!target) {
        return;
      }

      const button = target.closest('#stocks-import-csv');
      if (button) {
        console.log('📥 Bouton import CSV cliqué (event delegation)', {
          button: button,
          buttonId: button.id,
          viewParent: button.closest('.main-view')?.id,
          viewActive: button.closest('.main-view')?.classList.contains('view-active')
        });
        e.preventDefault();
        e.stopPropagation();
        this.open();
      }
    });

    console.log('✅ Event delegation attachée sur document');

    // Boutons fermer
    const closeBtn = document.getElementById('stocks-cancel-import');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Drop zone - Click to open file picker
    this.dropZone.addEventListener('click', (e) => {
      const target = this.getEventTargetElement(e);
      if (!target) {
        return;
      }

      // Ne pas déclencher si on clique sur le bouton
      if (target.tagName !== 'BUTTON' && !target.closest('button')) {
        this.fileInput.click();
      }
    });

    // Drop zone - Drag & drop
    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('dragover');
    });

    this.dropZone.addEventListener('dragleave', () => {
      this.dropZone.classList.remove('dragover');
    });

    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && this.isCSVFile(file)) {
        this.handleFile(file);
      } else {
        alert('Veuillez déposer un fichier CSV');
      }
    });

    // File input
    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleFile(file);
      }
    });

    // Boutons prévisualisation
    const confirmBtn = document.getElementById('csv-confirm-import');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.confirmImport());
    }

    const cancelPreviewBtn = document.getElementById('csv-cancel-preview');
    if (cancelPreviewBtn) {
      cancelPreviewBtn.addEventListener('click', () => this.cancelPreview());
    }

    // Bouton fermer résultats
    const closeResultsBtn = document.getElementById('csv-close-results');
    if (closeResultsBtn) {
      closeResultsBtn.addEventListener('click', () => this.close());
    }
  }

  /**
   * Ouvre la modale d'import
   */
  open() {
    console.log('🔓 Ouverture du panel d\'import CSV', {
      panel: this.panel,
      panelHidden: this.panel?.hidden
    });
    this.panel.hidden = false;
    this.reset();
  }

  /**
   * Ferme la modale d'import
   */
  close() {
    this.panel.hidden = true;
    this.reset();
  }

  /**
   * Réinitialise l'état
   */
  reset() {
    this.parsedData = null;
    this.fileInput.value = '';
    document.getElementById('csv-preview').hidden = true;
    document.getElementById('csv-results').hidden = true;
    this.dropZone.style.display = 'flex';
    document.querySelector('.csv-format-info').style.display = 'block';
  }

  /**
   * Retourne l'élément cible d'un évènement (compatible text nodes)
   */
  getEventTargetElement(event) {
    if (!event) {
      return null;
    }

    const target = event.target;
    if (target instanceof Element) {
      return target;
    }

    if (target && target.parentElement) {
      return target.parentElement;
    }

    return null;
  }

  /**
   * Vérifie si le fichier est un CSV
   */
  isCSVFile(file) {
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    const validExtensions = ['.csv'];
    return validTypes.includes(file.type) || validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  /**
   * Gère le fichier uploadé
   */
  async handleFile(file) {
    console.log('📄 Fichier sélectionné:', file.name);

    if (!this.isCSVFile(file)) {
      alert('Le fichier doit être au format CSV');
      return;
    }

    try {
      const text = await file.text();
      this.parsedData = this.parseCSV(text);

      if (this.parsedData && this.parsedData.length > 0) {
        this.showPreview();
      } else {
        alert('Le fichier CSV est vide ou mal formaté');
      }
    } catch (error) {
      console.error('❌ Erreur lecture fichier:', error);
      alert('Erreur lors de la lecture du fichier CSV');
    }
  }

  /**
   * Parse le CSV
   */
  parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] ? values[index].trim() : '';
        });
        data.push(row);
      }
    }

    return data;
  }

  /**
   * Affiche la prévisualisation
   */
  showPreview() {
    this.dropZone.style.display = 'none';
    document.querySelector('.csv-format-info').style.display = 'none';

    const previewDiv = document.getElementById('csv-preview');
    const previewContent = document.getElementById('csv-preview-content');

    let html = `<p><strong>${this.parsedData.length} produit(s)</strong> trouvé(s)</p>`;
    html += '<table class="csv-preview-table"><thead><tr>';

    // Headers
    const headers = Object.keys(this.parsedData[0]);
    headers.forEach(header => {
      html += `<th>${this.escapeHtml(header)}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Rows (max 5 pour preview)
    const previewRows = this.parsedData.slice(0, 5);
    previewRows.forEach(row => {
      html += '<tr>';
      headers.forEach(header => {
        html += `<td>${this.escapeHtml(row[header] || '')}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';

    if (this.parsedData.length > 5) {
      html += `<p class="csv-preview-note">... et ${this.parsedData.length - 5} autre(s) produit(s)</p>`;
    }

    previewContent.innerHTML = html;
    previewDiv.hidden = false;
  }

  /**
   * Annule la prévisualisation
   */
  cancelPreview() {
    this.reset();
  }

  /**
   * Confirme et envoie l'import
   */
  async confirmImport() {
    if (!this.parsedData || this.parsedData.length === 0) {
      alert('Aucune donnée à importer');
      return;
    }

    console.log('🚀 Envoi des données pour import...');

    const confirmBtn = document.getElementById('csv-confirm-import');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i data-lucide="loader"></i> Import en cours...';

    try {
      const response = await fetch(window.SempaStocksData.ajaxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'sempa_stocks_import_csv',
          nonce: window.SempaStocksData.nonce,
          products: JSON.stringify(this.parsedData)
        })
      });

      const result = await response.json();

      if (result.success) {
        this.showResults(result.data);
      } else {
        alert('Erreur lors de l\'import: ' + (result.data.message || 'Erreur inconnue'));
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i data-lucide="check"></i> Confirmer l\'import';
      }
    } catch (error) {
      console.error('❌ Erreur import:', error);
      alert('Erreur lors de l\'import des produits');
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i data-lucide="check"></i> Confirmer l\'import';
    }
  }

  /**
   * Affiche les résultats de l'import
   */
  showResults(data) {
    document.getElementById('csv-preview').hidden = true;

    const resultsDiv = document.getElementById('csv-results');
    const resultsContent = document.getElementById('csv-results-content');

    let html = '<div class="csv-results-summary">';
    html += `<h3>Import terminé</h3>`;
    html += `<p><strong class="success">${data.success_count || 0} produit(s) importé(s)</strong></p>`;

    if (data.errors && data.errors.length > 0) {
      html += `<p><strong class="error">${data.errors.length} erreur(s)</strong></p>`;
      html += '<div class="csv-errors"><h4>Détails des erreurs :</h4><ul>';
      data.errors.forEach(error => {
        html += `<li>${this.escapeHtml(error)}</li>`;
      });
      html += '</ul></div>';
    }

    html += '</div>';

    resultsContent.innerHTML = html;
    resultsDiv.hidden = false;

    // Recharger la liste des produits
    if (window.productsModule && data.success_count > 0) {
      window.productsModule.loadProducts();
    }
  }

  /**
   * Échappe HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Créer l'instance globale
window.importCSVModule = new ImportCSVModule();
console.log('✅ Module ImportCSVModule chargé et instance créée (window.importCSVModule)');