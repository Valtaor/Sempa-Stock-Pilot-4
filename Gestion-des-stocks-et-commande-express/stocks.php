<?php
/**
 * Template Name: Gestion des stocks SEMPA
 * Template Post Type: page
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();

$allowed = class_exists('Sempa_Stocks_App') ? Sempa_Stocks_App::user_is_allowed() : false;
$nonce = class_exists('Sempa_Stocks_App') ? Sempa_Stocks_App::nonce() : wp_create_nonce('sempa_stocks_nonce');

$current_user = wp_get_current_user();
$user_name = ($current_user instanceof WP_User && $current_user->exists())
    ? ($current_user->display_name ?: $current_user->user_login)
    : '';
$user_email = ($current_user instanceof WP_User && $current_user->exists()) ? $current_user->user_email : '';
$user_role = '';

if ($current_user instanceof WP_User && $current_user->exists()) {
    $roles = $current_user->roles;
    $primary_role = is_array($roles) && !empty($roles) ? reset($roles) : '';
    if ($primary_role) {
        $wp_roles = wp_roles();
        if ($wp_roles instanceof WP_Roles && isset($wp_roles->roles[$primary_role]['name'])) {
            $user_role = translate_user_role($wp_roles->roles[$primary_role]['name']);
        } else {
            $user_role = ucfirst(str_replace('_', ' ', $primary_role));
        }
    }
}

// Charger les assets StockPilot directement dans le template
// (au lieu d'utiliser wp_enqueue_scripts qui a des problèmes de timing)
$assets_url = get_stylesheet_directory_uri();
$version = time(); // Cache busting RADICAL - force rechargement total
?>

<!-- StockPilot CSS -->
<link rel="stylesheet" href="<?php echo esc_url($assets_url . '/assets/css/base/variables.css?ver=' . $version); ?>">
<link rel="stylesheet" href="<?php echo esc_url($assets_url . '/assets/css/components/buttons.css?ver=' . $version); ?>">
<link rel="stylesheet" href="<?php echo esc_url($assets_url . '/assets/css/components/badges.css?ver=' . $version); ?>">
<link rel="stylesheet" href="<?php echo esc_url($assets_url . '/assets/css/components/loader.css?ver=' . $version); ?>">
<link rel="stylesheet" href="<?php echo esc_url($assets_url . '/assets/css/components/dashboard.css?ver=' . $version); ?>">
<link rel="stylesheet" href="<?php echo esc_url($assets_url . '/assets/css/components/product-card.css?ver=' . $version); ?>">
<link rel="stylesheet" href="<?php echo esc_url($assets_url . '/assets/css/components/import-csv.css?ver=' . $version); ?>">
<link rel="stylesheet" href="<?php echo esc_url($assets_url . '/assets/css/views/products-view.css?ver=' . $version); ?>">

<!-- Fix visibilité produits + Sticky sidebar + Clics forcés -->
<style>
/* FIX CRITIQUE : Les vues cachées sont masquées avec display:none (géré par JS)
   On ne désactive plus pointer-events globalement car ça bloque TOUS les clics
   même sur les éléments enfants qui ont pointer-events: auto */
.main-view {
    /* Pas de pointer-events: none - on laisse le JS gérer avec display */
}

.main-view.view-active {
    pointer-events: auto !important;
}

/* Force overflow visible sur TOUS les parents du sidebar */
body,
.sempa-stocks-wrapper,
.stockpilot-app {
    overflow: visible !important;
}

/* Force l'affichage des produits - Override toute cascade CSS */
#view-products .sp-products-grid {
    display: grid !important;
    visibility: visible !important;
    opacity: 1 !important;
}

#view-products .sp-product-card {
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    background: #ffffff !important;
}

/* Force sticky sidebar - TOUTES les propriétés nécessaires */
.stockpilot-sidebar {
    position: -webkit-sticky !important;
    position: sticky !important;
    top: 0 !important;
    height: 100vh !important;
    align-self: flex-start !important;
    overflow-y: auto !important;
    will-change: transform !important;
}

/* FORCE CLIQUABILITÉ - z-index élevé pour passer au-dessus du ::after */
.stockpilot-sidebar__nav,
.stockpilot-sidebar__nav ul,
.stockpilot-sidebar__nav li,
.stockpilot-sidebar__nav a {
    position: relative !important;
    z-index: 100 !important;
    pointer-events: auto !important;
    cursor: pointer !important;
}

.stockpilot-sidebar__brand,
.stockpilot-sidebar__user {
    position: relative !important;
    z-index: 100 !important;
}

/* Force le ::after à rester derrière */
.stockpilot-sidebar::after {
    z-index: 0 !important;
    pointer-events: none !important;
}
</style>

<!-- Bibliothèques externes -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js"></script>
<script src="https://unpkg.com/lucide@latest"></script>

<!-- Données pour JavaScript - DOIT être chargé AVANT api.js -->
<script>
var SempaStocksData = <?php echo json_encode([
    'ajaxUrl' => admin_url('admin-ajax.php'),
    'nonce' => $nonce,
    'exportUrl' => admin_url('admin-post.php?action=sempa_stocks_export&_wpnonce=' . $nonce),
    'uploadsUrl' => trailingslashit(get_stylesheet_directory_uri()) . 'uploads-stocks/',
    'strings' => [
        'loading' => __('Chargement...', 'sempa'),
        'error' => __('Une erreur est survenue', 'sempa'),
        'success' => __('Opération réussie', 'sempa'),
        'confirm_delete' => __('Êtes-vous sûr de vouloir supprimer cet élément ?', 'sempa'),
        'unauthorized' => __('Vous n\'êtes pas autorisé à effectuer cette action.', 'sempa'),
        'unknownError' => __('Une erreur inattendue est survenue.', 'sempa'),
        'saved' => __('Produit enregistré avec succès.', 'sempa'),
        'deleted' => __('Produit supprimé.', 'sempa'),
        'allCategories' => __('Toutes les catégories', 'sempa'),
        'allSuppliers' => __('Tous les fournisseurs', 'sempa'),
        'noAlerts' => __('Aucune alerte critique', 'sempa'),
        'noRecent' => __('Aucun mouvement récent', 'sempa'),
        'productActions' => __('Actions produit', 'sempa'),
        'noProducts' => __('Aucun produit trouvé', 'sempa'),
        'noMovements' => __('Aucun mouvement enregistré', 'sempa'),
    ]
]); ?>;

// Diagnostic - Vérifier que SempaStocksData est bien chargé
console.log('🔍 DIAGNOSTIC SempaStocksData:', {
    exists: typeof SempaStocksData !== 'undefined',
    ajaxUrl: SempaStocksData?.ajaxUrl,
    nonce: SempaStocksData?.nonce ? 'présent' : 'manquant'
});
</script>

<!-- StockPilot JavaScript - Composants -->
<script src="<?php echo esc_url($assets_url . '/assets/js/components/Button.js?ver=' . $version); ?>"></script>
<script src="<?php echo esc_url($assets_url . '/assets/js/components/Badge.js?ver=' . $version); ?>"></script>
<script src="<?php echo esc_url($assets_url . '/assets/js/components/Loader.js?ver=' . $version); ?>"></script>
<script src="<?php echo esc_url($assets_url . '/assets/js/components/MetricCard.js?ver=' . $version); ?>"></script>
<script src="<?php echo esc_url($assets_url . '/assets/js/components/Chart.js?ver=' . $version); ?>"></script>
<script src="<?php echo esc_url($assets_url . '/assets/js/components/ProductCard.js?ver=' . $version); ?>"></script>

<!-- Données pour JavaScript (doivent être disponibles avant l'API) -->
<script>
window.SempaStocksData = <?php echo wp_json_encode([
    'ajaxUrl' => admin_url('admin-ajax.php'),
    'nonce' => $nonce,
    'exportUrl' => admin_url('admin-post.php?action=sempa_stocks_export&_wpnonce=' . $nonce),
    'uploadsUrl' => trailingslashit(get_stylesheet_directory_uri()) . 'uploads-stocks/',
    'strings' => [
        'loading' => __('Chargement...', 'sempa'),
        'error' => __('Une erreur est survenue', 'sempa'),
        'success' => __('Opération réussie', 'sempa'),
        'confirm_delete' => __('Êtes-vous sûr de vouloir supprimer cet élément ?', 'sempa'),
        'unauthorized' => __('Vous n\'êtes pas autorisé à effectuer cette action.', 'sempa'),
        'unknownError' => __('Une erreur inattendue est survenue.', 'sempa'),
        'saved' => __('Produit enregistré avec succès.', 'sempa'),
        'deleted' => __('Produit supprimé.', 'sempa'),
        'allCategories' => __('Toutes les catégories', 'sempa'),
        'allSuppliers' => __('Tous les fournisseurs', 'sempa'),
        'noAlerts' => __('Aucune alerte critique', 'sempa'),
        'noRecent' => __('Aucun mouvement récent', 'sempa'),
        'productActions' => __('Actions produit', 'sempa'),
        'noProducts' => __('Aucun produit trouvé', 'sempa'),
        'noMovements' => __('Aucun mouvement enregistré', 'sempa'),
    ]
]); ?>;

(function dispatchStockPilotDataReady(detail) {
    var eventName = 'StockPilotDataReady';

    try {
        window.dispatchEvent(new CustomEvent(eventName, { detail: detail }));
    } catch (error) {
        if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
            var legacyEvent = document.createEvent('CustomEvent');
            legacyEvent.initCustomEvent(eventName, false, false, detail);
            window.dispatchEvent(legacyEvent);
        }
    }
})(window.SempaStocksData);

console.log('🔍 StockPilot data ready:', {
    hasData: typeof window.SempaStocksData !== 'undefined',
    ajaxUrl: window.SempaStocksData?.ajaxUrl,
    hasNonce: Boolean(window.SempaStocksData?.nonce)
});
</script>

<!-- StockPilot JavaScript - Utilitaires -->
<script src="<?php echo esc_url($assets_url . '/assets/js/utils/api.js?ver=' . $version); ?>"></script>

<!-- Diagnostic API -->
<script>
console.log('🔍 DIAGNOSTIC API:', {
    apiExists: typeof window.api !== 'undefined',
    apiMethods: window.api ? Object.keys(window.api) : 'API non chargé'
});
</script>

<!-- StockPilot JavaScript - Modules -->
<script src="<?php echo esc_url($assets_url . '/assets/js/modules/dashboard.js?ver=' . $version); ?>"></script>
<script src="<?php echo esc_url($assets_url . '/assets/js/modules/products.js?ver=' . $version); ?>"></script>
<script src="<?php echo esc_url($assets_url . '/assets/js/modules/movements.js?ver=' . $version); ?>"></script>
<script src="<?php echo esc_url($assets_url . '/assets/js/modules/import-csv.js?ver=' . $version); ?>"></script>

<!-- StockPilot JavaScript - Application principale -->
<script src="<?php echo esc_url($assets_url . '/assets/js/app.js?ver=' . $version); ?>"></script>

<!-- Diagnostic API -->
<script>
if (typeof window.waitForStockPilotAPI === 'function') {
    window.waitForStockPilotAPI()
        .then(function(apiInstance) {
            console.log('✅ StockPilot API initialisée', {
                ajaxUrl: apiInstance?.ajaxUrl,
                hasNonce: Boolean(apiInstance?.nonce)
            });
        })
        .catch(function(error) {
            console.error('❌ StockPilot API non disponible', error);
        });
}
</script>

<!-- Configuration Chart.js -->
<script>
document.addEventListener('DOMContentLoaded', function() {
    // Initialiser Lucide Icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Configurer Chart.js
    if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        Chart.defaults.color = '#9ca3af';
        Chart.defaults.responsive = true;
        Chart.defaults.maintainAspectRatio = false;
        Chart.defaults.plugins.legend.display = false;
        Chart.defaults.plugins.tooltip = {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#f9fafb',
            bodyColor: '#d1d5db',
            borderColor: '#374151',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            boxPadding: 6,
            usePointStyle: true
        };
        console.log('✅ Chart.js configuré pour StockPilot');
    }

    // EVENT LISTENERS DIRECTS POUR LES BOUTONS
    // Attachés dès le chargement du DOM pour garantir qu'ils fonctionnent

    // DIAGNOSTIC - Lister tous les éléments avec z-index
    setTimeout(() => {
        const allElements = document.querySelectorAll('*');
        const elementsWithZIndex = [];
        allElements.forEach(el => {
            const zIndex = window.getComputedStyle(el).zIndex;
            if (zIndex && zIndex !== 'auto') {
                elementsWithZIndex.push({
                    element: el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.split(' ')[0] : ''),
                    zIndex: zIndex
                });
            }
        });
        console.log('🔍 Éléments avec z-index:', elementsWithZIndex.sort((a, b) => parseInt(b.zIndex) - parseInt(a.zIndex)));
    }, 500);

    // Bouton "Imprimer les mouvements"
    const printMovementsBtn = document.getElementById('stocks-print-movements');
    console.log('🔍 Recherche bouton imprimer mouvements:', {
        exists: !!printMovementsBtn,
        display: printMovementsBtn ? window.getComputedStyle(printMovementsBtn).display : 'N/A',
        visibility: printMovementsBtn ? window.getComputedStyle(printMovementsBtn).visibility : 'N/A',
        pointerEvents: printMovementsBtn ? window.getComputedStyle(printMovementsBtn).pointerEvents : 'N/A',
        zIndex: printMovementsBtn ? window.getComputedStyle(printMovementsBtn).zIndex : 'N/A'
    });

    if (printMovementsBtn) {
        console.log('✅ Bouton imprimer mouvements trouvé, attachement de l\'event listener');

        // Forcer le style pour garantir la cliquabilité
        printMovementsBtn.style.position = 'relative';
        printMovementsBtn.style.zIndex = '999';
        printMovementsBtn.style.pointerEvents = 'auto';
        printMovementsBtn.style.cursor = 'pointer';

        printMovementsBtn.addEventListener('click', function(e) {
            console.log('🖨️ CLIC sur Imprimer les mouvements');
            e.preventDefault();
            e.stopPropagation();
            const filtersDiv = document.getElementById('movements-print-filters');
            if (filtersDiv) {
                filtersDiv.style.display = 'block';
                console.log('✅ Formulaire de dates affiché');
            } else {
                console.error('❌ Élément movements-print-filters non trouvé');
            }
        }, true); // Use capture phase

        // Ajouter aussi un listener sur mousedown comme backup
        printMovementsBtn.addEventListener('mousedown', function(e) {
            console.log('🖱️ MOUSEDOWN sur Imprimer les mouvements');
        }, true);

        console.log('✅ Event listeners attachés sur le bouton imprimer mouvements');
    } else {
        console.error('❌ Bouton imprimer mouvements NON TROUVÉ');
    }

    // Bouton "Annuler" impression
    const cancelPrintBtn = document.getElementById('movements-print-cancel');
    if (cancelPrintBtn) {
        cancelPrintBtn.addEventListener('click', function(e) {
            console.log('❌ Annulation impression');
            e.preventDefault();
            const filtersDiv = document.getElementById('movements-print-filters');
            if (filtersDiv) {
                filtersDiv.style.display = 'none';
            }
        });
    }

    // Bouton "Importer un CSV"
    const importCSVBtn = document.getElementById('stocks-import-csv');
    console.log('🔍 Recherche bouton importer CSV:', {
        exists: !!importCSVBtn,
        display: importCSVBtn ? window.getComputedStyle(importCSVBtn).display : 'N/A',
        visibility: importCSVBtn ? window.getComputedStyle(importCSVBtn).visibility : 'N/A',
        pointerEvents: importCSVBtn ? window.getComputedStyle(importCSVBtn).pointerEvents : 'N/A',
        zIndex: importCSVBtn ? window.getComputedStyle(importCSVBtn).zIndex : 'N/A',
        parentView: importCSVBtn ? importCSVBtn.closest('.main-view')?.id : 'N/A',
        viewDisplay: importCSVBtn && importCSVBtn.closest('.main-view') ? window.getComputedStyle(importCSVBtn.closest('.main-view')).display : 'N/A'
    });

    if (importCSVBtn) {
        console.log('✅ Bouton importer CSV trouvé, attachement de l\'event listener');

        // Forcer le style pour garantir la cliquabilité
        importCSVBtn.style.position = 'relative';
        importCSVBtn.style.zIndex = '999';
        importCSVBtn.style.pointerEvents = 'auto';
        importCSVBtn.style.cursor = 'pointer';

        importCSVBtn.addEventListener('click', function(e) {
            console.log('📥 CLIC sur Importer CSV (event listener direct)');
            e.preventDefault();
            e.stopPropagation();
            const importPanel = document.getElementById('stocks-import-panel');
            if (importPanel) {
                // Forcer l'affichage avec display: flex au lieu de hidden
                importPanel.removeAttribute('hidden');
                importPanel.style.display = 'flex';
                console.log('✅ Panel d\'import affiché avec display: flex');
            } else {
                console.error('❌ Élément stocks-import-panel non trouvé');
            }
        }, true); // Use capture phase

        // Ajouter aussi un listener sur mousedown comme backup
        importCSVBtn.addEventListener('mousedown', function(e) {
            console.log('🖱️ MOUSEDOWN sur Importer CSV');
        }, true);

        console.log('✅ Event listeners attachés sur le bouton importer CSV');
    } else {
        console.error('❌ Bouton importer CSV NON TROUVÉ');
    }

    // Bouton fermer import CSV
    const closeImportBtn = document.getElementById('stocks-cancel-import');
    if (closeImportBtn) {
        closeImportBtn.addEventListener('click', function(e) {
            console.log('❌ Fermeture panel import');
            e.preventDefault();
            const importPanel = document.getElementById('stocks-import-panel');
            if (importPanel) {
                // Forcer la fermeture avec display: none
                importPanel.style.display = 'none';
                importPanel.setAttribute('hidden', 'hidden');
                console.log('✅ Panel fermé avec display: none');
            }
        });
    }
});
</script>

<div class="sempa-stocks-wrapper" data-stock-nonce="<?php echo esc_attr($nonce); ?>">
    <?php if (!$allowed) : ?>
        <section class="stocks-locked">
            <div class="stocks-locked__inner">
                <h1><?php esc_html_e('Accès réservé', 'sempa'); ?></h1>
                <p><?php esc_html_e('Cette application est réservée à l\'équipe SEMPA. Merci de vous connecter avec un compte autorisé.', 'sempa'); ?></p>
                <?php wp_login_form([
                    'label_username' => __('Identifiant ou adresse e-mail', 'sempa'),
                    'label_password' => __('Mot de passe', 'sempa'),
                    'label_remember' => __('Se souvenir de moi', 'sempa'),
                    'label_log_in' => __('Se connecter', 'sempa'),
                    'remember' => true,
                    'redirect' => home_url('/stock-pilot'),
                    'form_id' => 'stockpilot-login-form',
                ]); ?>
            </div>
        </section>
    <?php else : ?>
        <div class="stockpilot-app">
            <aside class="stockpilot-sidebar" role="navigation" aria-label="<?php esc_attr_e('Navigation principale', 'sempa'); ?>">
                <div class="stockpilot-sidebar__brand">
                    <img src="https://sempa.fr/wp-content/uploads/2021/05/logo-since-w.svg" alt="<?php esc_attr_e('Logo SEMPA', 'sempa'); ?>" class="sidebar-logo" loading="lazy" />
                </div>
                <nav class="stockpilot-sidebar__nav">
                    <ul class="menu-navigation">
                        <li><a href="#view-dashboard" data-view="dashboard" class="active"><i data-lucide="layout-dashboard" class="nav-icon-lucide"></i><?php esc_html_e('Tableau de bord', 'sempa'); ?></a></li>
                        <li><a href="#view-products" data-view="products"><i data-lucide="package" class="nav-icon-lucide"></i><?php esc_html_e('Produits', 'sempa'); ?></a></li>
                        <li><a href="#view-movements" data-view="movements"><i data-lucide="repeat" class="nav-icon-lucide"></i><?php esc_html_e('Mouvements', 'sempa'); ?></a></li>
                        <li><a href="#view-reports" data-view="reports"><i data-lucide="file-bar-chart" class="nav-icon-lucide"></i><?php esc_html_e('Rapports', 'sempa'); ?></a></li>
                        <li><a href="#view-settings" data-view="settings"><i data-lucide="settings" class="nav-icon-lucide"></i><?php esc_html_e('Paramètres', 'sempa'); ?></a></li>
                    </ul>
                </nav>
                <div class="stockpilot-sidebar__user">
                    <?php echo get_avatar($current_user ? $current_user->ID : 0, 48, '', '', ['class' => 'sidebar-avatar']); ?>
                    <div class="sidebar-user__meta">
                        <strong><?php echo esc_html($user_name ?: __('Utilisateur SEMPA', 'sempa')); ?></strong>
                        <?php if ($user_role) : ?>
                            <span><?php echo esc_html($user_role); ?></span>
                        <?php endif; ?>
                        <?php if ($user_email) : ?>
                            <span class="sidebar-user__email"><?php echo esc_html($user_email); ?></span>
                        <?php endif; ?>
                    </div>
                </div>
            </aside>

            <div class="stockpilot-main">
                <header class="stockpilot-header">
                    <div class="stockpilot-header__titles">
                        <p class="stockpilot-header__eyebrow"><?php esc_html_e('SEMPA Stocks', 'sempa'); ?></p>
                        <h1><?php esc_html_e('Tableau de bord StockPilot', 'sempa'); ?></h1>
                        <p class="stockpilot-header__subtitle"><?php esc_html_e('Suivez vos produits, alertes et mouvements dans une interface professionnelle.', 'sempa'); ?></p>
                    </div>
                    <div class="stockpilot-header__tools">
                        <label for="stocks-search" class="screen-reader-text"><?php esc_html_e('Rechercher un produit', 'sempa'); ?></label>
                        <div class="header-search">
                            <span aria-hidden="true" class="header-search__icon"></span>
                            <input type="search" id="stocks-search" aria-label="<?php esc_attr_e('Rechercher un produit par référence ou désignation', 'sempa'); ?>" placeholder="<?php esc_attr_e('Rechercher un produit…', 'sempa'); ?>" />
                        </div>
                        <div class="stockpilot-header__actions">
                            <a class="button button--ghost" href="#" id="stocks-export" data-export="1"><?php esc_html_e('Exporter CSV', 'sempa'); ?></a>
                            <button type="button" id="stocks-refresh" class="button button--primary"><?php esc_html_e('Actualiser', 'sempa'); ?></button>
                        </div>
                    </div>
                </header>

                <main class="stockpilot-content">
                    <section class="stockpilot-section main-view" id="view-dashboard" aria-labelledby="stocks-dashboard-title">
                        <div class="section-header">
                            <div>
                                <p class="section-eyebrow"><?php esc_html_e('Vue d\'ensemble', 'sempa'); ?></p>
                                <h2 id="stocks-dashboard-title"><?php esc_html_e('Tableau de bord', 'sempa'); ?></h2>
                            </div>
                            <div class="section-actions">
                                <button type="button" id="btn-refresh-dashboard" class="button button--ghost" aria-label="<?php esc_attr_e('Actualiser le dashboard', 'sempa'); ?>">
                                    <i data-lucide="refresh-cw"></i>
                                    <?php esc_html_e('Actualiser', 'sempa'); ?>
                                </button>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="toggle-auto-refresh" checked />
                                    <span class="toggle-slider"></span>
                                    <span class="toggle-label"><?php esc_html_e('Rafraîchissement auto (60s)', 'sempa'); ?></span>
                                </label>
                            </div>
                        </div>

                        <!-- Métriques principales -->
                        <div id="dashboard-metrics"></div>

                        <!-- Graphiques -->
                        <div class="sp-dashboard-charts">
                            <div class="sp-chart-container">
                                <div class="sp-chart-header">
                                    <h3><?php esc_html_e('Évolution de la valeur du stock', 'sempa'); ?></h3>
                                    <span class="sp-chart-period"><?php esc_html_e('30 derniers jours', 'sempa'); ?></span>
                                </div>
                                <div class="sp-chart-canvas-wrapper">
                                    <canvas id="chart-stock-value"></canvas>
                                </div>
                            </div>

                            <div class="sp-chart-container">
                                <div class="sp-chart-header">
                                    <h3><?php esc_html_e('Mouvements de stock', 'sempa'); ?></h3>
                                    <span class="sp-chart-period"><?php esc_html_e('7 derniers jours', 'sempa'); ?></span>
                                </div>
                                <div class="sp-chart-canvas-wrapper">
                                    <canvas id="chart-movements"></canvas>
                                </div>
                            </div>

                            <div class="sp-chart-container">
                                <div class="sp-chart-header">
                                    <h3><?php esc_html_e('Répartition par catégories', 'sempa'); ?></h3>
                                    <span class="sp-chart-period"><?php esc_html_e('Distribution actuelle', 'sempa'); ?></span>
                                </div>
                                <div class="sp-chart-canvas-wrapper">
                                    <canvas id="chart-categories"></canvas>
                                </div>
                            </div>
                        </div>

                        <!-- Activité et alertes -->
                        <div class="sp-dashboard-panels">
                            <div class="sp-panel">
                                <div class="sp-panel__header">
                                    <h3><?php esc_html_e('Activité récente', 'sempa'); ?></h3>
                                </div>
                                <div class="sp-panel__body">
                                    <div id="activity-feed"></div>
                                </div>
                            </div>

                            <div class="sp-panel">
                                <div class="sp-panel__header">
                                    <h3><?php esc_html_e('Alertes', 'sempa'); ?></h3>
                                </div>
                                <div class="sp-panel__body">
                                    <div id="alerts-panel"></div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="stockpilot-section main-view" id="view-products" aria-labelledby="stocks-products-title">
                        <div class="section-header">
                            <div>
                                <p class="section-eyebrow"><?php esc_html_e('Catalogue', 'sempa'); ?></p>
                                <h2 id="stocks-products-title"><?php esc_html_e('Produits', 'sempa'); ?></h2>
                                <p class="section-subtitle"><?php esc_html_e('Gérez vos références, fournisseurs et niveaux de stock.', 'sempa'); ?></p>
                            </div>
                            <div class="section-actions">
                                <div class="view-toggle" role="group" aria-label="<?php esc_attr_e('Basculer la vue', 'sempa'); ?>">
                                    <button type="button" class="view-toggle__btn view-toggle__btn--active" data-view-type="grid" aria-pressed="true">
                                        <i data-lucide="layout-grid"></i>
                                        <span><?php esc_html_e('Cartes', 'sempa'); ?></span>
                                    </button>
                                    <button type="button" class="view-toggle__btn" data-view-type="table" aria-pressed="false">
                                        <i data-lucide="table"></i>
                                        <span><?php esc_html_e('Tableau', 'sempa'); ?></span>
                                    </button>
                                </div>
                                <button type="button" class="button button--primary" id="stocks-open-product-form"><?php esc_html_e('Ajouter un produit', 'sempa'); ?></button>
                            </div>
                        </div>
                        <div class="products-toolbar" role="group" aria-label="<?php esc_attr_e('Filtres produits', 'sempa'); ?>">
                            <div class="toolbar-field">
                                <label for="stocks-filter-category"><?php esc_html_e('Catégorie', 'sempa'); ?></label>
                                <select id="stocks-filter-category"></select>
                            </div>
                            <div class="toolbar-field">
                                <label for="stocks-filter-supplier"><?php esc_html_e('Fournisseur', 'sempa'); ?></label>
                                <select id="stocks-filter-supplier"></select>
                            </div>
                            <div class="toolbar-field">
                                <label for="stocks-filter-status"><?php esc_html_e('Statut', 'sempa'); ?></label>
                                <select id="stocks-filter-status">
                                    <option value=""><?php esc_html_e('Tous les statuts', 'sempa'); ?></option>
                                    <option value="normal"><?php esc_html_e('En stock', 'sempa'); ?></option>
                                    <option value="warning"><?php esc_html_e('Stock faible', 'sempa'); ?></option>
                                    <option value="critical"><?php esc_html_e('Rupture', 'sempa'); ?></option>
                                </select>
                            </div>
                            <div class="toolbar-actions">
                                <button type="button" class="button button--ghost" id="stocks-clear-filters"><?php esc_html_e('Réinitialiser', 'sempa'); ?></button>
                            </div>
                        </div>
                        <!-- Grille de produits (mode carte) -->
                        <div id="products-grid-container" class="products-view">
                            <div class="sp-empty-state">
                                <i data-lucide="loader"></i>
                                <p><?php esc_html_e('Chargement des produits...', 'sempa'); ?></p>
                            </div>
                        </div>

                        <!-- Tableau de produits (mode tableau) -->
                        <div id="products-table-container" class="products-view">
                            <div class="table-wrapper">
                                <table class="stocks-table" id="stocks-products-table">
                                    <thead>
                                        <tr>
                                            <th scope="col"><?php esc_html_e('Référence', 'sempa'); ?></th>
                                            <th scope="col"><?php esc_html_e('Désignation', 'sempa'); ?></th>
                                            <th scope="col"><?php esc_html_e('Catégorie', 'sempa'); ?></th>
                                            <th scope="col"><?php esc_html_e('Fournisseur', 'sempa'); ?></th>
                                            <th scope="col"><?php esc_html_e('Stock', 'sempa'); ?></th>
                                            <th scope="col"><?php esc_html_e('Prix achat', 'sempa'); ?></th>
                                            <th scope="col"><?php esc_html_e('Prix vente', 'sempa'); ?></th>
                                            <th scope="col"><?php esc_html_e('État', 'sempa'); ?></th>
                                            <th scope="col"><?php esc_html_e('Actions', 'sempa'); ?></th>
                                        </tr>
                                    </thead>
                                    <tbody id="products-table-body">
                                        <!-- Le contenu sera généré par JavaScript -->
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Pagination -->
                        <div class="products-pagination" role="group" aria-label="<?php esc_attr_e('Pagination des produits', 'sempa'); ?>">
                            <div class="pagination-info">
                                <label for="products-per-page"><?php esc_html_e('Afficher', 'sempa'); ?></label>
                                <select id="products-per-page">
                                    <option value="12">12</option>
                                    <option value="24" selected>24</option>
                                    <option value="48">48</option>
                                    <option value="all"><?php esc_html_e('Tous', 'sempa'); ?></option>
                                </select>
                                <span><?php esc_html_e('par page', 'sempa'); ?></span>
                            </div>
                            <div class="pagination-status">
                                <span id="products-count-info"><?php esc_html_e('Chargement...', 'sempa'); ?></span>
                            </div>
                            <div class="pagination-controls">
                                <button type="button" id="products-prev-page" class="button button--ghost" disabled><?php esc_html_e('Précédent', 'sempa'); ?></button>
                                <span id="products-page-info" class="pagination-page-info"><?php esc_html_e('Page 1 sur 1', 'sempa'); ?></span>
                                <button type="button" id="products-next-page" class="button button--ghost" disabled><?php esc_html_e('Suivant', 'sempa'); ?></button>
                            </div>
                        </div>
                    </section>

                    <section class="stockpilot-section main-view" id="view-movements" aria-labelledby="stocks-movements-title">
                        <div class="section-header">
                            <div>
                                <p class="section-eyebrow"><?php esc_html_e('Suivi des flux', 'sempa'); ?></p>
                                <h2 id="stocks-movements-title"><?php esc_html_e('Mouvements de stock', 'sempa'); ?></h2>
                                <p class="section-subtitle"><?php esc_html_e('Analysez les entrées, sorties et ajustements récents.', 'sempa'); ?></p>
                            </div>
                            <div class="section-actions">
                                <button type="button" class="button button--ghost" id="stocks-print-movements"><?php esc_html_e('Imprimer les mouvements', 'sempa'); ?></button>
                                <button type="button" class="button button--secondary" id="stocks-open-movement-form"><?php esc_html_e('Enregistrer un mouvement', 'sempa'); ?></button>
                            </div>
                        </div>
                        <div class="movements-filters" style="display: none; margin-bottom: 24px; padding: 20px; background: #f9fafb; border-radius: 8px;" id="movements-print-filters">
                            <h3 style="margin: 0 0 16px; font-size: 16px;"><?php esc_html_e('Sélectionner la période à imprimer', 'sempa'); ?></h3>
                            <div style="display: flex; gap: 16px; align-items: flex-end;">
                                <label style="flex: 1;">
                                    <span style="display: block; margin-bottom: 8px; font-size: 14px; color: #374151;"><?php esc_html_e('Date de début', 'sempa'); ?></span>
                                    <input type="date" id="movements-start-date" class="form-control" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;" />
                                </label>
                                <label style="flex: 1;">
                                    <span style="display: block; margin-bottom: 8px; font-size: 14px; color: #374151;"><?php esc_html_e('Date de fin', 'sempa'); ?></span>
                                    <input type="date" id="movements-end-date" class="form-control" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;" />
                                </label>
                                <button type="button" class="button button--primary" id="movements-print-confirm"><?php esc_html_e('Imprimer', 'sempa'); ?></button>
                                <button type="button" class="button button--ghost" id="movements-print-cancel"><?php esc_html_e('Annuler', 'sempa'); ?></button>
                            </div>
                        </div>
                        <div class="table-wrapper">
                            <table class="stocks-table" id="stocks-movements-table">
                                <thead>
                                    <tr>
                                        <th scope="col"><?php esc_html_e('Date', 'sempa'); ?></th>
                                        <th scope="col"><?php esc_html_e('Produit', 'sempa'); ?></th>
                                        <th scope="col"><?php esc_html_e('Type', 'sempa'); ?></th>
                                        <th scope="col"><?php esc_html_e('Quantité', 'sempa'); ?></th>
                                        <th scope="col"><?php esc_html_e('Stock', 'sempa'); ?></th>
                                        <th scope="col"><?php esc_html_e('Motif', 'sempa'); ?></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colspan="6" class="empty"><?php esc_html_e('Chargement de l\'historique…', 'sempa'); ?></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section class="stockpilot-section main-view" id="view-reports" aria-labelledby="stocks-reports-title">
                        <div class="section-header">
                            <div>
                                <p class="section-eyebrow"><?php esc_html_e('Pilotage', 'sempa'); ?></p>
                                <h2 id="stocks-reports-title"><?php esc_html_e('Rapports & documents', 'sempa'); ?></h2>
                                <p class="section-subtitle"><?php esc_html_e('Exportez vos données et accédez aux ressources partagées.', 'sempa'); ?></p>
                            </div>
                        </div>
                        <div class="reports-grid">
                            <article class="report-card">
                                <h3><?php esc_html_e('Rapport valeur du stock', 'sempa'); ?></h3>
                                <p><?php esc_html_e('Téléchargez la photographie financière actuelle du stock SEMPA.', 'sempa'); ?></p>
                                <a href="<?php echo esc_url(admin_url('admin-post.php?action=sempa_stocks_export&_wpnonce=' . $nonce)); ?>" class="button button--primary" id="stocks-export-csv" target="_blank"><?php esc_html_e('Exporter au format CSV', 'sempa'); ?></a>
                            </article>
                            <article class="report-card">
                                <h3><?php esc_html_e('Importer des données', 'sempa'); ?></h3>
                                <p><?php esc_html_e('Importez des produits depuis un fichier CSV pour mettre à jour votre stock rapidement.', 'sempa'); ?></p>
                                <button type="button" class="button button--primary" id="stocks-import-csv"><?php esc_html_e('Importer un CSV', 'sempa'); ?></button>
                            </article>
                            <article class="report-card">
                                <h3><?php esc_html_e('Documents techniques', 'sempa'); ?></h3>
                                <p><?php esc_html_e('Les PDF et médias liés aux fiches produits restent accessibles depuis la liste principale.', 'sempa'); ?></p>
                                <a class="button button--secondary" href="<?php echo esc_url(trailingslashit(get_stylesheet_directory_uri()) . 'uploads-stocks/'); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e('Ouvrir le dossier partagé', 'sempa'); ?></a>
                            </article>
                        </div>
                    </section>

                    <section class="stockpilot-section main-view" id="view-settings" aria-labelledby="stockpilot-settings-title">
                        <div class="section-header">
                            <div>
                                <p class="section-eyebrow"><?php esc_html_e('Automations', 'sempa'); ?></p>
                                <h2 id="stockpilot-settings-title"><?php esc_html_e('Raccourcis d\'administration', 'sempa'); ?></h2>
                                <p class="section-subtitle"><?php esc_html_e('Activez les fonctionnalités clés de StockPilot pour gagner du temps.', 'sempa'); ?></p>
                            </div>
                        </div>
                        <div class="automation-grid">
                            <article class="automation-card">
                                <h3><?php esc_html_e('Recherche produits', 'sempa'); ?></h3>
                                <p><?php esc_html_e('Filtrage instantané par référence, catégorie ou fournisseur.', 'sempa'); ?></p>
                                <span class="automation-status automation-status--active"><?php esc_html_e('Actif', 'sempa'); ?></span>
                            </article>
                            <article class="automation-card">
                                <h3><?php esc_html_e('Filtres avancés', 'sempa'); ?></h3>
                                <p><?php esc_html_e('Combinez plusieurs critères pour isoler vos segments critiques.', 'sempa'); ?></p>
                                <span class="automation-status automation-status--active"><?php esc_html_e('Actif', 'sempa'); ?></span>
                            </article>
                            <article class="automation-card">
                                <h3><?php esc_html_e('Export CSV', 'sempa'); ?></h3>
                                <p><?php esc_html_e('Synchronisez vos données avec vos outils BI en un clic.', 'sempa'); ?></p>
                                <span class="automation-status automation-status--active"><?php esc_html_e('Actif', 'sempa'); ?></span>
                            </article>
                            <article class="automation-card">
                                <h3><?php esc_html_e('Alertes automatiques', 'sempa'); ?></h3>
                                <p><?php esc_html_e('Restez informé dès qu\'un stock passe sous le seuil minimum.', 'sempa'); ?></p>
                                <span class="automation-status automation-status--planned"><?php esc_html_e('Bientôt', 'sempa'); ?></span>
                            </article>
                        </div>
                    </section>
                </main>

                <aside class="stockpilot-drawers">
                    <section class="stocks-form" id="stocks-product-panel" hidden>
                        <div class="stocks-form__header">
                            <h2><?php esc_html_e('Fiche produit', 'sempa'); ?></h2>
                            <button type="button" class="stocks-form__close" id="stocks-cancel-product" aria-label="<?php esc_attr_e('Fermer la fiche produit', 'sempa'); ?>"></button>
                        </div>
                        <form id="stock-product-form" enctype="multipart/form-data">
                            <input type="hidden" name="action" value="sempa_stocks_save_product" />
                            <input type="hidden" name="nonce" value="<?php echo esc_attr($nonce); ?>" />
                            <input type="hidden" name="id" value="" />
                            <div class="form-grid">
                                <label>
                                    <span><?php esc_html_e('Référence', 'sempa'); ?> *</span>
                                    <input type="text" name="reference" required />
                                </label>
                                <label>
                                    <span><?php esc_html_e('Désignation', 'sempa'); ?> *</span>
                                    <input type="text" name="designation" required />
                                </label>
                                <label>
                                    <span><?php esc_html_e('Catégorie', 'sempa'); ?></span>
                                    <div class="field-with-action">
                                        <select name="categorie" id="stocks-category-select"></select>
                                        <button type="button" class="link-button" data-action="add-category"><?php esc_html_e('Ajouter', 'sempa'); ?></button>
                                    </div>
                                </label>
                                <label>
                                    <span><?php esc_html_e('Fournisseur', 'sempa'); ?></span>
                                    <div class="field-with-action">
                                        <select name="fournisseur" id="stocks-supplier-select"></select>
                                        <button type="button" class="link-button" data-action="add-supplier"><?php esc_html_e('Ajouter', 'sempa'); ?></button>
                                    </div>
                                </label>
                                <label>
                                    <span><?php esc_html_e('État du matériel', 'sempa'); ?> *</span>
                                    <select name="etat_materiel" required>
                                        <option value="neuf"><?php esc_html_e('Neuf', 'sempa'); ?></option>
                                        <option value="reconditionné"><?php esc_html_e('Reconditionné', 'sempa'); ?></option>
                                    </select>
                                </label>
                                <label>
                                    <span><?php esc_html_e('Prix d\'achat (€)', 'sempa'); ?></span>
                                    <input type="number" name="prix_achat" step="0.01" min="0" />
                                </label>
                                <label>
                                    <span><?php esc_html_e('Prix de vente (€)', 'sempa'); ?></span>
                                    <input type="number" name="prix_vente" step="0.01" min="0" />
                                </label>
                                <label>
                                    <span><?php esc_html_e('Stock actuel', 'sempa'); ?></span>
                                    <input type="number" name="stock_actuel" min="0" />
                                </label>
                                <label>
                                    <span><?php esc_html_e('Stock minimum', 'sempa'); ?></span>
                                    <input type="number" name="stock_minimum" min="0" />
                                </label>
                                <label>
                                    <span><?php esc_html_e('Stock maximum', 'sempa'); ?></span>
                                    <input type="number" name="stock_maximum" min="0" />
                                </label>
                                <label>
                                    <span><?php esc_html_e('Emplacement', 'sempa'); ?></span>
                                    <input type="text" name="emplacement" />
                                </label>
                                <label>
                                    <span><?php esc_html_e('Date d\'entrée', 'sempa'); ?></span>
                                    <input type="date" name="date_entree" />
                                </label>
                                <label class="file">
                                    <span><?php esc_html_e('Document (PDF ou image)', 'sempa'); ?></span>
                                    <input type="file" name="document" accept=".pdf,image/*" />
                                </label>
                                <label class="notes">
                                    <span><?php esc_html_e('Notes internes', 'sempa'); ?></span>
                                    <textarea name="notes" rows="4"></textarea>
                                </label>
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="button button--primary"><?php esc_html_e('Enregistrer', 'sempa'); ?></button>
                                <button type="button" class="button button--ghost" data-dismiss="product"><?php esc_html_e('Annuler', 'sempa'); ?></button>
                            </div>
                        </form>
                        <aside class="meta" id="stocks-product-meta"></aside>
                    </section>

                    <section class="stocks-form" id="stocks-movement-panel" hidden>
                        <div class="stocks-form__header">
                            <h2><?php esc_html_e('Ajouter un mouvement', 'sempa'); ?></h2>
                            <button type="button" class="stocks-form__close" id="stocks-cancel-movement" aria-label="<?php esc_attr_e('Fermer le formulaire mouvement', 'sempa'); ?>"></button>
                        </div>
                        <form id="stock-movement-form">
                            <input type="hidden" name="action" value="sempa_stocks_record_movement" />
                            <input type="hidden" name="nonce" value="<?php echo esc_attr($nonce); ?>" />
                            <div class="form-grid">
                                <label>
                                    <span><?php esc_html_e('Produit concerné', 'sempa'); ?></span>
                                    <select name="produit_id" id="movement-product"></select>
                                </label>
                                <label>
                                    <span><?php esc_html_e('Type de mouvement', 'sempa'); ?></span>
                                    <select name="type_mouvement">
                                        <option value="entree"><?php esc_html_e('Entrée', 'sempa'); ?></option>
                                        <option value="sortie"><?php esc_html_e('Sortie', 'sempa'); ?></option>
                                        <option value="ajustement"><?php esc_html_e('Ajustement', 'sempa'); ?></option>
                                    </select>
                                </label>
                                <label>
                                    <span><?php esc_html_e('Quantité', 'sempa'); ?></span>
                                    <input type="number" name="quantite" min="0" required />
                                </label>
                                <label class="notes">
                                    <span><?php esc_html_e('Motif / commentaire', 'sempa'); ?></span>
                                    <textarea name="motif" rows="3"></textarea>
                                </label>
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="button button--primary"><?php esc_html_e('Enregistrer le mouvement', 'sempa'); ?></button>
                                <button type="button" class="button button--ghost" data-dismiss="movement"><?php esc_html_e('Annuler', 'sempa'); ?></button>
                            </div>
                        </form>
                    </section>

                    <section class="stocks-form stocks-form--wide" id="stocks-import-panel" hidden>
                        <div class="stocks-form__header">
                            <h2><?php esc_html_e('Importer des produits depuis un CSV', 'sempa'); ?></h2>
                            <button type="button" class="stocks-form__close" id="stocks-cancel-import" aria-label="<?php esc_attr_e('Fermer l\'import CSV', 'sempa'); ?>"></button>
                        </div>

                        <div class="csv-drop-zone" id="csv-drop-zone">
                            <i data-lucide="upload-cloud"></i>
                            <h3><?php esc_html_e('Glissez-déposez votre fichier CSV ici', 'sempa'); ?></h3>
                            <p><?php esc_html_e('ou cliquez pour sélectionner un fichier', 'sempa'); ?></p>
                            <input type="file" id="csv-file-input" accept=".csv" style="display: none;" />
                        </div>

                        <div class="csv-format-info">
                            <h4><?php esc_html_e('Format attendu', 'sempa'); ?></h4>
                            <pre><code>reference,designation,categorie,fournisseur,etat_materiel,prix_achat,prix_vente,stock_actuel,stock_minimum,stock_maximum,emplacement,notes</code></pre>
                            <div class="csv-format-note">
                                <i data-lucide="info"></i>
                                <span><?php esc_html_e('Les colonnes doivent correspondre exactement à ce format. La première ligne doit contenir les noms des colonnes.', 'sempa'); ?></span>
                            </div>
                            <a href="<?php echo esc_url(get_stylesheet_directory_uri() . '/exemple-import.csv'); ?>" class="button button--ghost" download>
                                <i data-lucide="download"></i>
                                <?php esc_html_e('Télécharger un exemple', 'sempa'); ?>
                            </a>
                        </div>

                        <div id="csv-preview" class="csv-preview" hidden>
                            <h4><?php esc_html_e('Prévisualisation des données', 'sempa'); ?></h4>
                            <div id="csv-preview-content"></div>
                            <div class="csv-preview-actions">
                                <button type="button" class="button button--ghost" id="csv-cancel-preview">
                                    <i data-lucide="x"></i>
                                    <?php esc_html_e('Annuler', 'sempa'); ?>
                                </button>
                                <button type="button" class="button button--primary" id="csv-confirm-import">
                                    <i data-lucide="check"></i>
                                    <?php esc_html_e('Confirmer l\'import', 'sempa'); ?>
                                </button>
                            </div>
                        </div>

                        <div id="csv-results" class="csv-results" hidden>
                            <div id="csv-results-content"></div>
                            <button type="button" class="button button--primary" id="csv-close-results">
                                <?php esc_html_e('Fermer', 'sempa'); ?>
                            </button>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    <?php endif; ?>
</div>
<?php
get_footer();