<?php
/**
 * Uncode Child Theme - functions.php
 * Version SEMPA - Ordre de chargement corrigé + Hooks AJAX Réintégrés
 */

if (!defined('ABSPATH')) {
    exit; // Sécurité
}

// ===========================================
// 1. INCLUSIONS DES FICHIERS DE LOGIQUE MÉTIER
// ===========================================
$stocks_file = __DIR__ . '/includes/functions_stocks.php';
if (file_exists($stocks_file)) {
    // Ce fichier DOIT définir les fonctions:
    // inventory_get_products_ajax, inventory_add_product_ajax,
    // inventory_update_product_ajax, inventory_delete_product_ajax
    // (ou les noms équivalents pour Sempa)
    require_once $stocks_file;
} else {
    error_log("Fichier Sempa requis manquant: functions_stocks.php");
}

$commandes_file = __DIR__ . '/includes/functions_commandes.php';
if (file_exists($commandes_file)) {
    require_once $commandes_file;
}
// else { error_log("Fichier Sempa requis manquant: functions_commandes.php"); }

$db_commandes_file = __DIR__ . '/includes/db_commandes.php';
if (file_exists($db_commandes_file)) {
    require_once $db_commandes_file;
}

$file_integrity = __DIR__ . '/includes/file-integrity.php';
if (file_exists($file_integrity)) {
    require_once $file_integrity;
}

$healthcheck_file = __DIR__ . '/includes/healthcheck.php';
if (file_exists($healthcheck_file)) {
    require_once $healthcheck_file;
}

// DÉSACTIVÉ : Le chargement des assets est maintenant fait directement dans stocks.php
// pour éviter les problèmes de timing avec is_page_template() et is_front_page()
// qui ne fonctionnent pas toujours correctement dans wp_enqueue_scripts
/*
$enqueue_assets_file = __DIR__ . '/includes/enqueue-assets.php';
if (file_exists($enqueue_assets_file)) {
    require_once $enqueue_assets_file;
}
*/


// ===========================================
// 2. DÉFINITION DES CLASSES PRINCIPALES
// ===========================================

// --- Classe Thème ---
final class Sempa_Theme { /* ... (Code inchangé) ... */
    public static function register() { add_action('after_setup_theme', [__CLASS__, 'load_text_domain']); add_action('wp_enqueue_scripts', [__CLASS__, 'enqueue_styles'], 100); add_filter('uncode_activate_menu_badges', '__return_true'); }
    public static function load_text_domain() { load_child_theme_textdomain('uncode', get_stylesheet_directory() . '/languages'); }
    public static function enqueue_styles() { $v = wp_rand(); $p = 'uncode-style'; wp_enqueue_style($p, get_template_directory_uri() . '/library/css/style.css', [], $v); wp_enqueue_style('child-style', get_stylesheet_directory_uri() . '/style.css', [$p], $v); }
}

// --- Classe RankMath ---
final class Sempa_RankMath { /* ... (Code inchangé) ... */
    public static function register() { add_filter('rank_math/sitemap/portfolio/enabled', '__return_false'); add_filter('rank_math/sitemap/post_tag/enabled', '__return_false'); add_filter('rank_math/sitemap/portfolio_category/enabled', '__return_false'); add_filter('rank_math/sitemap/page_category/enabled', '__return_false'); }
}

// --- Classe Rôle Utilisateur ---
final class Sempa_Stock_Role { /* ... (Code inchangé, avec correction add_role) ... */
    const ROLE_KEY = 'gestionnaire_de_stock';
    public static function register() { add_action('init', [__CLASS__, 'ensure_role_exists']); }
    public static function ensure_role_exists() { if (get_role(self::ROLE_KEY)) return; add_role(self::ROLE_KEY, 'Gestionnaire de Stock', ['read' => true, 'manage_sempa_stock' => true]); }
}

// --- Classe Principale d'Initialisation ---
final class Sempa_App
{
    public static function boot()
    {
        Sempa_Theme::register();
        Sempa_RankMath::register();
        Sempa_Stock_Role::register();

        // Enregistrer les routes REST (si elles existent)
        if (class_exists('Sempa_Order_Route')) Sempa_Order_Route::register();
        if (class_exists('Sempa_Contact_Route')) Sempa_Contact_Route::register();
        if (class_exists('Sempa_Order_Manager')) Sempa_Order_Manager::register();

        // Enregistrer les autres composants (si définis dans les includes)
        if (class_exists('Sempa_Stock_Permissions')) Sempa_Stock_Permissions::register();
        if (class_exists('Sempa_Stock_Routes')) Sempa_Stock_Routes::register();
        if (class_exists('Sempa_Login_Redirect')) Sempa_Login_Redirect::register();
        if (class_exists('Sempa_Stocks_App')) Sempa_Stocks_App::register();
        if (class_exists('Sempa_Stocks_Login')) Sempa_Stocks_Login::register();

        // *** IMPORTANT: Enregistrer les hooks AJAX ici aussi si besoin ***
        // Ou s'assurer qu'ils sont bien enregistrés DANS les classes ci-dessus
        // via add_action('wp_ajax_...', ...) dans leurs méthodes register() ou init().
    }
}


// ===========================================
// 3. APPEL DE L'INITIALISATION (à la fin)
// ===========================================
Sempa_App::boot();

?>