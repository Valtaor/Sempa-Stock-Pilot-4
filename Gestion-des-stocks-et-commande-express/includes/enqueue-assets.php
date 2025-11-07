<?php
/**
 * Enqueue Assets pour StockPilot Refonte
 *
 * Charge les nouveaux fichiers CSS et JavaScript pour la refonte
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Charge les assets de la refonte StockPilot
 */
function sempa_stocks_enqueue_refonte_assets() {
    // Ne JAMAIS charger dans l'admin WordPress
    if (is_admin()) {
        return;
    }

    // Ne charger QUE sur la page stock-pilot
    // Exclure explicitement : page d'accueil, blog, archives, etc.
    if (is_front_page() || is_home() || is_archive() || is_search() || is_404()) {
        return;
    }

    // Vérifier qu'on est bien sur le template stocks.php OU la page stock-pilot
    if (!is_page_template('stocks.php') && !is_page('stock-pilot')) {
        return;
    }

    $version = time(); // Version pour cache busting (utilise timestamp pour forcer rechargement)
    $assets_url = get_stylesheet_directory_uri(); // Thème child

    /* ========================================================================
       CSS
       ======================================================================== */

    // Variables CSS (tokens de design)
    wp_enqueue_style(
        'sp-variables',
        $assets_url . '/assets/css/base/variables.css',
        [],
        $version
    );

    // Composants CSS
    wp_enqueue_style(
        'sp-buttons',
        $assets_url . '/assets/css/components/buttons.css',
        ['sp-variables'],
        $version
    );

    wp_enqueue_style(
        'sp-badges',
        $assets_url . '/assets/css/components/badges.css',
        ['sp-variables'],
        $version
    );

    wp_enqueue_style(
        'sp-loader',
        $assets_url . '/assets/css/components/loader.css',
        ['sp-variables'],
        $version
    );

    wp_enqueue_style(
        'sp-dashboard',
        $assets_url . '/assets/css/components/dashboard.css',
        ['sp-variables'],
        $version
    );

    wp_enqueue_style(
        'sp-product-card',
        $assets_url . '/assets/css/components/product-card.css',
        ['sp-variables'],
        $version
    );

    // Vue produits
    wp_enqueue_style(
        'sp-products-view',
        $assets_url . '/assets/css/views/products-view.css',
        ['sp-variables', 'sp-product-card'],
        $version
    );

    /* ========================================================================
       BIBLIOTHÈQUES EXTERNES
       ======================================================================== */

    // Chart.js (pour les graphiques)
    wp_enqueue_script(
        'chartjs',
        'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js',
        [],
        '4.4.1',
        true
    );

    // Lucide Icons (icônes modernes)
    wp_enqueue_script(
        'lucide',
        'https://unpkg.com/lucide@latest',
        [],
        'latest',
        true
    );

    /* ========================================================================
       JAVASCRIPT - COMPOSANTS
       ======================================================================== */

    // Composant Button
    wp_enqueue_script(
        'sp-button',
        $assets_url . '/assets/js/components/Button.js',
        [],
        $version,
        true
    );

    // Composant Badge
    wp_enqueue_script(
        'sp-badge',
        $assets_url . '/assets/js/components/Badge.js',
        [],
        $version,
        true
    );

    // Composant Loader
    wp_enqueue_script(
        'sp-loader',
        $assets_url . '/assets/js/components/Loader.js',
        [],
        $version,
        true
    );

    // Composant MetricCard
    wp_enqueue_script(
        'sp-metric-card',
        $assets_url . '/assets/js/components/MetricCard.js',
        ['sp-loader'],
        $version,
        true
    );

    // Composant Chart (wrapper Chart.js)
    wp_enqueue_script(
        'sp-chart',
        $assets_url . '/assets/js/components/Chart.js',
        ['chartjs'],
        $version,
        true
    );

    // Composant ProductCard
    wp_enqueue_script(
        'sp-product-card',
        $assets_url . '/assets/js/components/ProductCard.js',
        ['sp-badge'],
        $version,
        true
    );

    /* ========================================================================
       JAVASCRIPT - UTILITAIRES
       ======================================================================== */

    // Client API
    wp_enqueue_script(
        'sp-api',
        $assets_url . '/assets/js/utils/api.js',
        [],
        $version,
        true
    );

    /* ========================================================================
       JAVASCRIPT - MODULES
       ======================================================================== */

    // Module Dashboard
    wp_enqueue_script(
        'sp-dashboard',
        $assets_url . '/assets/js/modules/dashboard.js',
        ['sp-api', 'sp-metric-card', 'sp-chart', 'sp-loader'],
        $version,
        true
    );

    // Module Products
    wp_enqueue_script(
        'sp-products',
        $assets_url . '/assets/js/modules/products.js',
        ['sp-api', 'sp-product-card', 'sp-loader'],
        $version,
        true
    );

    // Module Movements
    wp_enqueue_script(
        'sp-movements',
        $assets_url . '/assets/js/modules/movements.js',
        ['sp-api', 'sp-loader'],
        $version,
        true
    );

    /* ========================================================================
       JAVASCRIPT - APPLICATION PRINCIPALE
       ======================================================================== */

    // Point d'entrée principal de l'application
    wp_enqueue_script(
        'sp-app',
        $assets_url . '/assets/js/app.js',
        ['sp-dashboard', 'sp-products', 'sp-movements', 'lucide'],
        $version,
        true
    );

    /* ========================================================================
       INITIALISATION LUCIDE ICONS
       ======================================================================== */

    // Script inline pour initialiser Lucide après chargement
    wp_add_inline_script(
        'lucide',
        'document.addEventListener("DOMContentLoaded", function() {
            if (window.lucide) {
                lucide.createIcons();
            }
        });'
    );

    /* ========================================================================
       DONNÉES POUR JAVASCRIPT
       ======================================================================== */

    // Passer les données nécessaires au JavaScript
    // (déjà fait par SempaStocksData dans l'ancien code, mais on vérifie)
    if (!wp_script_is('sempa-stocks-data', 'enqueued')) {
        wp_localize_script('sp-api', 'SempaStocksData', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('sempa_stocks_nonce'),
            'strings' => [
                'loading' => __('Chargement...', 'sempa'),
                'error' => __('Une erreur est survenue', 'sempa'),
                'success' => __('Opération réussie', 'sempa'),
                'confirm_delete' => __('Êtes-vous sûr de vouloir supprimer cet élément ?', 'sempa'),
            ]
        ]);
    }
}

// Hook pour charger les assets
add_action('wp_enqueue_scripts', 'sempa_stocks_enqueue_refonte_assets', 20);

/**
 * Configuration Chart.js par défaut
 *
 * Script inline pour configurer Chart.js avec les styles StockPilot
 */
function sempa_stocks_chartjs_config() {
    // Ne JAMAIS charger dans l'admin WordPress
    if (is_admin()) {
        return;
    }

    // Ne charger QUE sur la page stock-pilot
    if (is_front_page() || is_home() || is_archive() || is_search() || is_404()) {
        return;
    }

    // Vérifier qu'on est bien sur le template stocks.php OU la page stock-pilot
    if (!is_page_template('stocks.php') && !is_page('stock-pilot')) {
        return;
    }

    ?>
    <script>
    // Configuration globale Chart.js
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof Chart !== 'undefined') {
            // Polices
            Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            Chart.defaults.color = '#9ca3af'; // --sp-gray-400

            // Responsive
            Chart.defaults.responsive = true;
            Chart.defaults.maintainAspectRatio = false;

            // Légende
            Chart.defaults.plugins.legend.display = false;

            // Tooltip
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
    });
    </script>
    <?php
}

add_action('wp_footer', 'sempa_stocks_chartjs_config', 5);