<?php
/**
 * Endpoint de healthcheck pour le monitoring de l'application
 *
 * Ce fichier fournit un endpoint REST pour vérifier l'état de santé
 * de l'application SEMPA Stock Pilot.
 *
 * @package SEMPA
 * @since 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe de gestion du healthcheck
 */
final class Sempa_Healthcheck
{
    /**
     * Version de l'API healthcheck
     */
    private const API_VERSION = '2.0.0';

    /**
     * Namespace de l'API REST
     */
    private const REST_NAMESPACE = 'sempa/v1';

    /**
     * Route de l'endpoint
     */
    private const REST_ROUTE = 'health';

    /**
     * Seuils critiques
     */
    private const DISK_SPACE_WARNING_MB = 1000;  // 1 GB
    private const DISK_SPACE_CRITICAL_MB = 500;  // 500 MB

    /**
     * Enregistre les hooks WordPress nécessaires
     */
    public static function register()
    {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    /**
     * Enregistre les routes REST API
     */
    public static function register_routes()
    {
        register_rest_route(self::REST_NAMESPACE, '/' . self::REST_ROUTE, [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'handle_healthcheck'],
            'permission_callback' => '__return_true', // Accessible publiquement pour monitoring externe
        ]);
    }

    /**
     * Handler principal du healthcheck
     *
     * @param WP_REST_Request $request Requête REST
     * @return WP_REST_Response Réponse avec l'état de santé
     */
    public static function handle_healthcheck($request)
    {
        $start_time = microtime(true);

        // Effectuer tous les checks
        $checks = [
            'database' => self::check_database(),
            'files' => self::check_critical_files(),
            'disk_space' => self::check_disk_space(),
            'php' => self::check_php_environment(),
            'integrity' => self::check_file_integrity(),
        ];

        // Déterminer le statut global
        $status = self::determine_overall_status($checks);

        // Calculer le temps de réponse
        $response_time = round((microtime(true) - $start_time) * 1000, 2);

        // Construire la réponse
        $response = [
            'status' => $status,
            'version' => self::API_VERSION,
            'timestamp' => current_time('mysql'),
            'response_time_ms' => $response_time,
            'checks' => $checks,
            'system' => [
                'php_version' => PHP_VERSION,
                'wordpress_version' => get_bloginfo('version'),
                'theme' => wp_get_theme()->get('Name'),
                'site_url' => home_url(),
            ],
        ];

        // Déterminer le code HTTP de retour
        $http_code = self::get_http_code($status);

        return new WP_REST_Response($response, $http_code);
    }

    /**
     * Vérifie la connexion à la base de données
     *
     * @return array Résultat du check
     */
    private static function check_database()
    {
        $start = microtime(true);

        try {
            $db = Sempa_Stocks_DB::instance();

            // Vérifier que la connexion est établie
            if (!($db instanceof \wpdb) || empty($db->dbh)) {
                return [
                    'status' => 'critical',
                    'message' => 'Connexion à la base de données échouée',
                    'response_time_ms' => round((microtime(true) - $start) * 1000, 2),
                ];
            }

            // Vérifier que les tables existent
            $tables_exist = Sempa_Stocks_DB::table_exists('stocks_sempa')
                && Sempa_Stocks_DB::table_exists('mouvements_stocks_sempa')
                && Sempa_Stocks_DB::table_exists('fournisseurs_sempa');

            if (!$tables_exist) {
                return [
                    'status' => 'critical',
                    'message' => 'Certaines tables critiques sont manquantes',
                    'response_time_ms' => round((microtime(true) - $start) * 1000, 2),
                ];
            }

            // Compter les produits pour vérifier que la table est accessible
            $table = Sempa_Stocks_DB::table('stocks_sempa');
            $count = $db->get_var("SELECT COUNT(*) FROM " . Sempa_Stocks_DB::escape_identifier($table));

            $response_time = round((microtime(true) - $start) * 1000, 2);

            return [
                'status' => 'healthy',
                'message' => 'Connexion à la base de données OK',
                'details' => [
                    'host' => Sempa_Stocks_DB::get_host(),
                    'database' => Sempa_Stocks_DB::get_database(),
                    'products_count' => (int) $count,
                ],
                'response_time_ms' => $response_time,
            ];
        } catch (\Throwable $e) {
            return [
                'status' => 'critical',
                'message' => 'Erreur lors de la connexion à la base de données',
                'error' => $e->getMessage(),
                'response_time_ms' => round((microtime(true) - $start) * 1000, 2),
            ];
        }
    }

    /**
     * Vérifie la présence des fichiers critiques
     *
     * @return array Résultat du check
     */
    private static function check_critical_files()
    {
        $critical_files = [
            'functions.php',
            'includes/functions_stocks.php',
            'includes/db_connect_stocks.php',
            'includes/functions_commandes.php',
            'includes/file-integrity.php',
            'includes/healthcheck.php',
        ];

        $base_dir = get_stylesheet_directory();
        $missing_files = [];
        $total_size = 0;

        foreach ($critical_files as $file) {
            $file_path = $base_dir . '/' . $file;

            if (!file_exists($file_path)) {
                $missing_files[] = $file;
            } else {
                $total_size += filesize($file_path);
            }
        }

        if (!empty($missing_files)) {
            return [
                'status' => 'critical',
                'message' => count($missing_files) . ' fichier(s) critique(s) manquant(s)',
                'details' => [
                    'missing_files' => $missing_files,
                ],
            ];
        }

        return [
            'status' => 'healthy',
            'message' => 'Tous les fichiers critiques sont présents',
            'details' => [
                'files_checked' => count($critical_files),
                'total_size_kb' => round($total_size / 1024, 2),
            ],
        ];
    }

    /**
     * Vérifie l'espace disque disponible
     *
     * @return array Résultat du check
     */
    private static function check_disk_space()
    {
        $base_dir = get_stylesheet_directory();

        if (!is_readable($base_dir)) {
            return [
                'status' => 'warning',
                'message' => 'Impossible de lire le répertoire de base',
            ];
        }

        $free_space = disk_free_space($base_dir);
        $total_space = disk_total_space($base_dir);

        if ($free_space === false || $total_space === false) {
            return [
                'status' => 'warning',
                'message' => 'Impossible de récupérer l\'espace disque',
            ];
        }

        $free_space_mb = round($free_space / 1024 / 1024, 2);
        $total_space_gb = round($total_space / 1024 / 1024 / 1024, 2);
        $used_percent = round((($total_space - $free_space) / $total_space) * 100, 2);

        // Déterminer le statut en fonction de l'espace libre
        if ($free_space_mb < self::DISK_SPACE_CRITICAL_MB) {
            $status = 'critical';
            $message = 'Espace disque critique !';
        } elseif ($free_space_mb < self::DISK_SPACE_WARNING_MB) {
            $status = 'warning';
            $message = 'Espace disque faible';
        } else {
            $status = 'healthy';
            $message = 'Espace disque OK';
        }

        return [
            'status' => $status,
            'message' => $message,
            'details' => [
                'free_space_mb' => $free_space_mb,
                'total_space_gb' => $total_space_gb,
                'used_percent' => $used_percent,
            ],
        ];
    }

    /**
     * Vérifie l'environnement PHP
     *
     * @return array Résultat du check
     */
    private static function check_php_environment()
    {
        $required_extensions = ['mysqli', 'json', 'mbstring'];
        $missing_extensions = [];

        foreach ($required_extensions as $ext) {
            if (!extension_loaded($ext)) {
                $missing_extensions[] = $ext;
            }
        }

        $memory_limit = ini_get('memory_limit');
        $max_execution_time = ini_get('max_execution_time');
        $upload_max_filesize = ini_get('upload_max_filesize');

        if (!empty($missing_extensions)) {
            return [
                'status' => 'critical',
                'message' => 'Extensions PHP manquantes',
                'details' => [
                    'missing_extensions' => $missing_extensions,
                ],
            ];
        }

        // Vérifier la version PHP
        if (version_compare(PHP_VERSION, '7.4.0', '<')) {
            return [
                'status' => 'warning',
                'message' => 'Version PHP obsolète (minimum recommandé: 7.4)',
                'details' => [
                    'php_version' => PHP_VERSION,
                ],
            ];
        }

        return [
            'status' => 'healthy',
            'message' => 'Environnement PHP OK',
            'details' => [
                'php_version' => PHP_VERSION,
                'memory_limit' => $memory_limit,
                'max_execution_time' => $max_execution_time . 's',
                'upload_max_filesize' => $upload_max_filesize,
            ],
        ];
    }

    /**
     * Vérifie l'intégrité des fichiers (si le système est activé)
     *
     * @return array Résultat du check
     */
    private static function check_file_integrity()
    {
        if (!class_exists('Sempa_File_Integrity')) {
            return [
                'status' => 'warning',
                'message' => 'Système de vérification d\'intégrité non disponible',
            ];
        }

        $status = Sempa_File_Integrity::get_status();

        if ($status['status'] === 'not_initialized') {
            return [
                'status' => 'warning',
                'message' => 'Système de vérification d\'intégrité non initialisé',
            ];
        }

        return [
            'status' => 'healthy',
            'message' => 'Surveillance d\'intégrité active',
            'details' => [
                'files_monitored' => $status['files_monitored'],
                'last_check' => $status['last_check'],
                'next_check' => $status['next_check'],
            ],
        ];
    }

    /**
     * Détermine le statut global à partir de tous les checks
     *
     * @param array $checks Résultats de tous les checks
     * @return string Statut global (healthy, degraded, critical)
     */
    private static function determine_overall_status($checks)
    {
        $has_critical = false;
        $has_warning = false;

        foreach ($checks as $check) {
            if ($check['status'] === 'critical') {
                $has_critical = true;
            } elseif ($check['status'] === 'warning') {
                $has_warning = true;
            }
        }

        if ($has_critical) {
            return 'critical';
        }

        if ($has_warning) {
            return 'degraded';
        }

        return 'healthy';
    }

    /**
     * Retourne le code HTTP approprié selon le statut
     *
     * @param string $status Statut de santé
     * @return int Code HTTP
     */
    private static function get_http_code($status)
    {
        switch ($status) {
            case 'healthy':
                return 200;
            case 'degraded':
                return 200; // Fonctionnel mais dégradé
            case 'critical':
                return 503; // Service Unavailable
            default:
                return 500;
        }
    }
}

// Enregistrer les hooks si WordPress est chargé
if (function_exists('add_action')) {
    Sempa_Healthcheck::register();
}
