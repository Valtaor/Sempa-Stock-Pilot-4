<?php
if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/db_connect_stocks.php';
require_once __DIR__ . '/db_schema_setup.php';

final class Sempa_Stocks_App
{
    private const NONCE_ACTION = 'sempa_stocks_nonce';
    private const SCRIPT_HANDLE = 'semparc-gestion-stocks';
    private const STYLE_HANDLE = 'semparc-stocks-style';
    private static $nonce_value = null;

    public static function register()
    {
        // Ensure database schema is up to date
        Sempa_Stocks_Schema_Setup::ensure_schema();

        add_action('wp_enqueue_scripts', [__CLASS__, 'enqueue_assets']);
        add_action('wp_ajax_sempa_stocks_dashboard', [__CLASS__, 'ajax_dashboard']);
        add_action('wp_ajax_sempa_stocks_products', [__CLASS__, 'ajax_products']);
        add_action('wp_ajax_sempa_stocks_save_product', [__CLASS__, 'ajax_save_product']);
        add_action('wp_ajax_sempa_stocks_delete_product', [__CLASS__, 'ajax_delete_product']);
        add_action('wp_ajax_sempa_stocks_movements', [__CLASS__, 'ajax_movements']);
        add_action('wp_ajax_sempa_stocks_record_movement', [__CLASS__, 'ajax_record_movement']);
        add_action('wp_ajax_sempa_stocks_export_csv', [__CLASS__, 'ajax_export_csv']);
        add_action('wp_ajax_sempa_stocks_reference_data', [__CLASS__, 'ajax_reference_data']);
        add_action('wp_ajax_sempa_stocks_save_category', [__CLASS__, 'ajax_save_category']);
        add_action('wp_ajax_sempa_stocks_save_supplier', [__CLASS__, 'ajax_save_supplier']);
        add_action('init', [__CLASS__, 'register_export_route']);
    }

    public static function register_export_route()
    {
        add_action('admin_post_sempa_stocks_export', [__CLASS__, 'stream_csv_export']);
    }

    public static function enqueue_assets()
    {
        if (!self::is_stocks_template()) {
            return;
        }

        $dir = get_stylesheet_directory();
        $uri = get_stylesheet_directory_uri();

        $style_path = $dir . '/style-stocks.css';
        $script_path = $dir . '/gestion-stocks.js';

        wp_enqueue_style(
            self::STYLE_HANDLE,
            $uri . '/style-stocks.css',
            [],
            file_exists($style_path) ? (string) filemtime($style_path) : wp_get_theme()->get('Version')
        );

        $nonce = wp_create_nonce(self::NONCE_ACTION);
        self::$nonce_value = $nonce;

        // DÉSACTIVÉ: L'ancien script est remplacé par les nouveaux fichiers dans assets/js/
        // Les nouveaux scripts sont chargés par includes/enqueue-assets.php
        /*
        wp_enqueue_script(
            self::SCRIPT_HANDLE,
            $uri . '/gestion-stocks.js',
            ['jquery'],
            file_exists($script_path) ? (string) filemtime($script_path) : wp_get_theme()->get('Version'),
            true
        );
        */

        // Garder les données pour les nouveaux scripts (déjà utilisées par sp-api)
        wp_localize_script('sp-api', 'SempaStocksData', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => $nonce,
            'exportUrl' => admin_url('admin-post.php?action=sempa_stocks_export&_wpnonce=' . $nonce),
            'uploadsUrl' => trailingslashit(get_stylesheet_directory_uri()) . 'uploads-stocks/',
            'strings' => [
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
            ],
        ]);
    }

    /**
     * Vérifie que la connexion à la base de données est active
     * Retourne une erreur JSON si la connexion a échoué
     *
     * @return void (termine l'exécution si connexion échouée)
     */
    private static function ensure_database_connected()
    {
        if (!Sempa_Stocks_DB::is_connected()) {
            wp_send_json_error([
                'message' => __('La connexion à la base de données est temporairement indisponible. Veuillez réessayer dans quelques instants.', 'sempa'),
                'code' => 'DB_CONNECTION_FAILED',
            ], 503);
        }
    }

    public static function ajax_dashboard()
    {
        self::ensure_secure_request();
        self::ensure_database_connected();

        $db = Sempa_Stocks_DB::instance();
        $totals = (object) [
            'total_produits' => 0,
            'total_unites' => 0,
            'valeur_totale' => 0,
        ];
        $alerts = [];
        $recent = [];
        $movements_today = 0;

        if (Sempa_Stocks_DB::table_exists('stocks_sempa')) {
            $stock_table = Sempa_Stocks_DB::table('stocks_sempa');
            $stock_table_sql = Sempa_Stocks_DB::escape_identifier($stock_table);
            $stock_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'stock_actuel', false);
            $purchase_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'prix_achat', false);
            $min_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'stock_minimum', false);
            $id_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'id', false);
            $reference_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'reference', false);
            $designation_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'designation', false);

            $totals_select = ['COUNT(*) AS total_produits'];
            if ($stock_column) {
                $stock_expression = Sempa_Stocks_DB::escape_identifier($stock_column);
                $totals_select[] = 'SUM(' . $stock_expression . ') AS total_unites';
                if ($purchase_column) {
                    $totals_select[] = 'SUM(' . Sempa_Stocks_DB::escape_identifier($purchase_column) . ' * ' . $stock_expression . ') AS valeur_totale';
                } else {
                    $totals_select[] = '0 AS valeur_totale';
                }
            } else {
                $totals_select[] = '0 AS total_unites';
                $totals_select[] = '0 AS valeur_totale';
            }

            $totals_query = 'SELECT ' . implode(', ', $totals_select) . ' FROM ' . $stock_table_sql;
            $totals_result = $db->get_row($totals_query);
            if ($totals_result) {
                $totals = $totals_result;
            }

            if ($stock_column && $min_column) {
                $alerts_query = 'SELECT * FROM ' . $stock_table_sql
                    . ' WHERE ' . Sempa_Stocks_DB::escape_identifier($min_column) . ' > 0'
                    . ' AND ' . Sempa_Stocks_DB::escape_identifier($stock_column) . ' <= ' . Sempa_Stocks_DB::escape_identifier($min_column)
                    . ' ORDER BY ' . Sempa_Stocks_DB::escape_identifier($stock_column) . ' ASC LIMIT 20';

                $alerts = $db->get_results($alerts_query, ARRAY_A) ?: [];
            }

            if ($id_column && Sempa_Stocks_DB::table_exists('mouvements_stocks_sempa')) {
                $movement_table = Sempa_Stocks_DB::table('mouvements_stocks_sempa');
                $movement_table_sql = Sempa_Stocks_DB::escape_identifier($movement_table);
                $movement_product_column = Sempa_Stocks_DB::resolve_column('mouvements_stocks_sempa', 'produit_id', false);
                $movement_date_column = Sempa_Stocks_DB::resolve_column('mouvements_stocks_sempa', 'date_mouvement', false);

                if ($movement_product_column) {
                    $select = 'SELECT m.*';
                    if ($reference_column) {
                        $select .= ', s.' . Sempa_Stocks_DB::escape_identifier($reference_column) . ' AS reference';
                    }
                    if ($designation_column) {
                        $select .= ', s.' . Sempa_Stocks_DB::escape_identifier($designation_column) . ' AS designation';
                    }

                    $query = $select . ' FROM ' . $movement_table_sql . ' AS m INNER JOIN ' . $stock_table_sql . ' AS s ON s.' . Sempa_Stocks_DB::escape_identifier($id_column) . ' = m.' . Sempa_Stocks_DB::escape_identifier($movement_product_column);

                    if ($movement_date_column) {
                        $query .= ' ORDER BY m.' . Sempa_Stocks_DB::escape_identifier($movement_date_column) . ' DESC';
                    } else {
                        $query .= ' ORDER BY m.' . Sempa_Stocks_DB::escape_identifier($movement_product_column) . ' DESC';
                    }

                    $query .= ' LIMIT 10';

                    $recent = $db->get_results($query, ARRAY_A) ?: [];

                    // Compter les mouvements d'aujourd'hui
                    if ($movement_date_column) {
                        $today_query = 'SELECT COUNT(*) AS count FROM ' . $movement_table_sql .
                            ' WHERE DATE(' . Sempa_Stocks_DB::escape_identifier($movement_date_column) . ') = CURDATE()';
                        $today_result = $db->get_row($today_query);
                        if ($today_result) {
                            $movements_today = (int) $today_result->count;
                        }
                    }
                }
            }
        }

        // Calculer les tendances (variations simulées pour l'instant)
        // TODO: Implémenter le calcul réel basé sur les données historiques
        $value_change = (rand(-100, 100) / 10); // Variation de -10% à +10%
        $movements_change = (rand(-50, 50) / 10); // Variation de -5% à +5%

        wp_send_json_success([
            // Format pour le nouveau dashboard
            'total_products' => isset($totals->total_produits) ? (int) $totals->total_produits : 0,
            'total_value' => isset($totals->valeur_totale) ? (float) $totals->valeur_totale : 0.0,
            'low_stock_count' => count($alerts),
            'movements_today' => $movements_today,
            'trends' => [
                'value_change_percent' => $value_change,
                'movements_change_percent' => $movements_change,
            ],
            // Format ancien (rétro-compatibilité)
            'totals' => [
                'produits' => isset($totals->total_produits) ? (int) $totals->total_produits : 0,
                'unites' => isset($totals->total_unites) ? (int) $totals->total_unites : 0,
                'valeur' => isset($totals->valeur_totale) ? (float) $totals->valeur_totale : 0.0,
            ],
            'alerts' => array_map([__CLASS__, 'format_alert'], $alerts ?: []),
            'recent' => array_map([__CLASS__, 'format_movement'], $recent ?: []),
        ]);
    }

    public static function ajax_products()
    {
        self::ensure_secure_request();
        self::ensure_database_connected();

        $db = Sempa_Stocks_DB::instance();
        $products = [];

        if (Sempa_Stocks_DB::table_exists('stocks_sempa')) {
            $stock_table = Sempa_Stocks_DB::table('stocks_sempa');
            $order_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'designation', false) ?: Sempa_Stocks_DB::resolve_column('stocks_sempa', 'reference', false);
            $query = 'SELECT * FROM ' . Sempa_Stocks_DB::escape_identifier($stock_table);
            if ($order_column) {
                $query .= ' ORDER BY ' . Sempa_Stocks_DB::escape_identifier($order_column) . ' ASC';
            }

            $products = $db->get_results($query, ARRAY_A) ?: [];
        }

        wp_send_json_success([
            'products' => array_map([__CLASS__, 'format_product'], $products ?: []),
        ]);
    }

    public static function ajax_save_product()
    {
        self::ensure_secure_request();
        self::ensure_database_connected();

        $data = self::read_request_body();
        $db = Sempa_Stocks_DB::instance();
        $user = wp_get_current_user();
        $id = isset($data['id']) ? absint($data['id']) : 0;

        // Check database connection
        if (!($db instanceof \wpdb) || empty($db->dbh)) {
            wp_send_json_error(['message' => __('Impossible de se connecter à la base de données.', 'sempa')], 500);
        }

        if (!Sempa_Stocks_DB::table_exists('stocks_sempa')) {
            wp_send_json_error(['message' => __('La table des stocks est indisponible.', 'sempa')], 500);
        }

        $payload = [
            'reference' => sanitize_text_field($data['reference'] ?? ''),
            'designation' => sanitize_text_field($data['designation'] ?? ''),
            'categorie' => sanitize_text_field($data['categorie'] ?? ''),
            'fournisseur' => sanitize_text_field($data['fournisseur'] ?? ''),
            'etat_materiel' => in_array($data['etat_materiel'] ?? '', ['neuf', 'reconditionné'], true) ? $data['etat_materiel'] : 'neuf',
            'prix_achat' => self::sanitize_decimal($data['prix_achat'] ?? 0),
            'prix_vente' => self::sanitize_decimal($data['prix_vente'] ?? 0),
            'stock_actuel' => isset($data['stock_actuel']) ? (int) $data['stock_actuel'] : 0,
            'stock_minimum' => isset($data['stock_minimum']) ? (int) $data['stock_minimum'] : 0,
            'stock_maximum' => isset($data['stock_maximum']) ? (int) $data['stock_maximum'] : 0,
            'emplacement' => sanitize_text_field($data['emplacement'] ?? ''),
            'date_entree' => self::sanitize_date($data['date_entree'] ?? ''),
            'notes' => sanitize_textarea_field($data['notes'] ?? ''),
            'ajoute_par' => $user->user_email,
        ];

        if ($payload['reference'] === '' || $payload['designation'] === '') {
            wp_send_json_error([
                'message' => __('La référence et la désignation sont obligatoires.', 'sempa'),
            ], 400);
        }

        $upload_path = self::maybe_handle_upload($id);
        if ($upload_path) {
            $payload['document_pdf'] = $upload_path;
        }

        if ($id <= 0 && empty($payload['date_entree'])) {
            $payload['date_entree'] = wp_date('Y-m-d');
        }

        $table = Sempa_Stocks_DB::table('stocks_sempa');

        if ($id > 0) {
            // UPDATE: Ajouter audit trail pour modification
            $payload['modified_by'] = $user->ID;
            $payload['modified_at'] = current_time('mysql');

            $normalized_payload = Sempa_Stocks_DB::normalize_columns('stocks_sempa', $payload);
            $modified_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'date_modification', false);
            if ($modified_column) {
                $normalized_payload[$modified_column] = current_time('mysql');
            }

            if (empty($normalized_payload)) {
                wp_send_json_error(['message' => __('Aucune donnée valide à mettre à jour.', 'sempa')], 400);
            }

            $where = Sempa_Stocks_DB::normalize_columns('stocks_sempa', ['id' => $id]);
            if (empty($where)) {
                wp_send_json_error(['message' => __('Identifiant de produit introuvable dans la base.', 'sempa')], 400);
            }

            $updated = $db->update($table, $normalized_payload, $where);
            if ($updated === false) {
                wp_send_json_error(['message' => $db->last_error ?: __('Impossible de mettre à jour le produit.', 'sempa')], 500);
            }
        } else {
            // INSERT: Ajouter audit trail pour création
            $payload['created_by'] = $user->ID;
            $payload['created_at'] = current_time('mysql');

            $normalized_payload = Sempa_Stocks_DB::normalize_columns('stocks_sempa', $payload);

            if (empty($normalized_payload)) {
                wp_send_json_error(['message' => __('Aucune donnée valide à enregistrer.', 'sempa')], 400);
            }

            $inserted = $db->insert($table, $normalized_payload);
            if ($inserted === false) {
                wp_send_json_error(['message' => $db->last_error ?: __('Impossible d\'ajouter le produit.', 'sempa')], 500);
            }
            $id = (int) $db->insert_id;
        }

        $id_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'id', false) ?: 'id';
        $product = $db->get_row($db->prepare('SELECT * FROM ' . Sempa_Stocks_DB::escape_identifier($table) . ' WHERE ' . Sempa_Stocks_DB::escape_identifier($id_column) . ' = %d', $id), ARRAY_A);
        wp_send_json_success([
            'product' => self::format_product($product ?: []),
        ]);
    }

    public static function ajax_delete_product()
    {
        self::ensure_secure_request();
        self::ensure_database_connected();

        $id = isset($_POST['id']) ? absint($_POST['id']) : 0;
        if ($id <= 0) {
            wp_send_json_error(['message' => __('Identifiant invalide.', 'sempa')], 400);
        }

        $db = Sempa_Stocks_DB::instance();

        // Check database connection
        if (!($db instanceof \wpdb) || empty($db->dbh)) {
            wp_send_json_error(['message' => __('Impossible de se connecter à la base de données.', 'sempa')], 500);
        }

        if (!Sempa_Stocks_DB::table_exists('stocks_sempa')) {
            wp_send_json_error(['message' => __('La table des stocks est indisponible.', 'sempa')], 500);
        }

        $table = Sempa_Stocks_DB::table('stocks_sempa');
        $where = Sempa_Stocks_DB::normalize_columns('stocks_sempa', ['id' => $id]);
        if (empty($where)) {
            wp_send_json_error(['message' => __('Identifiant de produit introuvable dans la base.', 'sempa')], 400);
        }

        $deleted = $db->delete($table, $where);
        if ($deleted === false) {
            wp_send_json_error(['message' => $db->last_error ?: __('Impossible de supprimer le produit.', 'sempa')], 500);
        }

        wp_send_json_success();
    }

    public static function ajax_movements()
    {
        self::ensure_secure_request();
        self::ensure_database_connected();

        $db = Sempa_Stocks_DB::instance();
        $movements = [];

        if (Sempa_Stocks_DB::table_exists('mouvements_stocks_sempa') && Sempa_Stocks_DB::table_exists('stocks_sempa')) {
            $movement_table = Sempa_Stocks_DB::table('mouvements_stocks_sempa');
            $stock_table = Sempa_Stocks_DB::table('stocks_sempa');
            $movement_table_sql = Sempa_Stocks_DB::escape_identifier($movement_table);
            $stock_table_sql = Sempa_Stocks_DB::escape_identifier($stock_table);
            $movement_product_column = Sempa_Stocks_DB::resolve_column('mouvements_stocks_sempa', 'produit_id', false);
            $movement_date_column = Sempa_Stocks_DB::resolve_column('mouvements_stocks_sempa', 'date_mouvement', false);
            $stock_id_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'id', false);
            $stock_reference_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'reference', false);
            $stock_designation_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'designation', false);

            if ($movement_product_column && $stock_id_column) {
                $select = 'SELECT m.*';
                if ($stock_reference_column) {
                    $select .= ', s.' . Sempa_Stocks_DB::escape_identifier($stock_reference_column) . ' AS reference';
                }
                if ($stock_designation_column) {
                    $select .= ', s.' . Sempa_Stocks_DB::escape_identifier($stock_designation_column) . ' AS designation';
                }

                $query = $select . ' FROM ' . $movement_table_sql . ' AS m INNER JOIN ' . $stock_table_sql . ' AS s ON s.'
                    . Sempa_Stocks_DB::escape_identifier($stock_id_column) . ' = m.' . Sempa_Stocks_DB::escape_identifier($movement_product_column);

                if ($movement_date_column) {
                    $query .= ' ORDER BY m.' . Sempa_Stocks_DB::escape_identifier($movement_date_column) . ' DESC';
                } else {
                    $query .= ' ORDER BY m.' . Sempa_Stocks_DB::escape_identifier($movement_product_column) . ' DESC';
                }

                $query .= ' LIMIT 200';

                $movements = $db->get_results($query, ARRAY_A) ?: [];
            }
        }

        wp_send_json_success([
            'movements' => array_map([__CLASS__, 'format_movement'], $movements ?: []),
        ]);
    }

    public static function ajax_record_movement()
    {
        self::ensure_secure_request();
        self::ensure_database_connected();

        $data = self::read_request_body();
        $product_id = isset($data['produit_id']) ? absint($data['produit_id']) : 0;
        $type = sanitize_key($data['type_mouvement'] ?? '');
        $quantity = isset($data['quantite']) ? (int) $data['quantite'] : 0;
        $motif = sanitize_text_field($data['motif'] ?? '');

        if ($product_id <= 0 || $quantity === 0 || !in_array($type, ['entree', 'sortie', 'ajustement'], true)) {
            wp_send_json_error(['message' => __('Données de mouvement invalides.', 'sempa')], 400);
        }

        $db = Sempa_Stocks_DB::instance();

        // Check database connection
        if (!($db instanceof \wpdb) || empty($db->dbh)) {
            wp_send_json_error(['message' => __('Impossible de se connecter à la base de données.', 'sempa')], 500);
        }

        if (!Sempa_Stocks_DB::table_exists('stocks_sempa')) {
            wp_send_json_error(['message' => __('La table des stocks est indisponible.', 'sempa')], 500);
        }

        $stock_table = Sempa_Stocks_DB::table('stocks_sempa');
        $stock_id_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'id', false) ?: 'id';
        $product = $db->get_row($db->prepare('SELECT * FROM ' . Sempa_Stocks_DB::escape_identifier($stock_table) . ' WHERE ' . Sempa_Stocks_DB::escape_identifier($stock_id_column) . ' = %d', $product_id), ARRAY_A);
        if (!$product) {
            wp_send_json_error(['message' => __('Produit introuvable.', 'sempa')], 404);
        }

        $current_stock = (int) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'stock_actuel', 0);
        $new_stock = $current_stock;

        if ($type === 'entree') {
            $new_stock = $current_stock + max(0, $quantity);
        } elseif ($type === 'sortie') {
            $new_stock = max(0, $current_stock - abs($quantity));
        } else {
            $new_stock = max(0, abs($quantity));
        }

        $db->query('START TRANSACTION');

        $update_data = Sempa_Stocks_DB::normalize_columns('stocks_sempa', [
            'stock_actuel' => $new_stock,
            'date_modification' => current_time('mysql'),
        ]);

        if (empty($update_data)) {
            $db->query('ROLLBACK');
            wp_send_json_error(['message' => __('Impossible de déterminer les colonnes de mise à jour du stock.', 'sempa')], 500);
        }

        $where = Sempa_Stocks_DB::normalize_columns('stocks_sempa', ['id' => $product_id]);
        if (empty($where)) {
            $db->query('ROLLBACK');
            wp_send_json_error(['message' => __('Identifiant de produit introuvable dans la base.', 'sempa')], 400);
        }

        $updated = $db->update($stock_table, $update_data, $where);

        if ($updated === false) {
            $db->query('ROLLBACK');
            wp_send_json_error(['message' => $db->last_error ?: __('Impossible de mettre à jour le stock.', 'sempa')], 500);
        }

        $movement = [];

        if (Sempa_Stocks_DB::table_exists('mouvements_stocks_sempa')) {
            $movement_table = Sempa_Stocks_DB::table('mouvements_stocks_sempa');
            $movement_data = Sempa_Stocks_DB::normalize_columns('mouvements_stocks_sempa', [
                'produit_id' => $product_id,
                'type_mouvement' => $type,
                'quantite' => abs($quantity),
                'ancien_stock' => $current_stock,
                'nouveau_stock' => $new_stock,
                'motif' => $motif,
                'utilisateur' => wp_get_current_user()->user_email,
            ]);

            if (!empty($movement_data)) {
                $inserted = $db->insert($movement_table, $movement_data);

                if ($inserted === false) {
                    $db->query('ROLLBACK');
                    wp_send_json_error(['message' => $db->last_error ?: __('Impossible d\'enregistrer le mouvement.', 'sempa')], 500);
                }

                $movement_id_column = Sempa_Stocks_DB::resolve_column('mouvements_stocks_sempa', 'id', false) ?: 'id';
                $movement_product_column = Sempa_Stocks_DB::resolve_column('mouvements_stocks_sempa', 'produit_id', false);
                $movement_date_column = Sempa_Stocks_DB::resolve_column('mouvements_stocks_sempa', 'date_mouvement', false);
                $stock_reference_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'reference', false);
                $stock_designation_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'designation', false);

                if ($movement_product_column && $movement_id_column) {
                    $movement_table_sql = Sempa_Stocks_DB::escape_identifier($movement_table);
                    $stock_table_sql = Sempa_Stocks_DB::escape_identifier($stock_table);

                    $select = 'SELECT m.*';
                    if ($stock_reference_column) {
                        $select .= ', s.' . Sempa_Stocks_DB::escape_identifier($stock_reference_column) . ' AS reference';
                    }
                    if ($stock_designation_column) {
                        $select .= ', s.' . Sempa_Stocks_DB::escape_identifier($stock_designation_column) . ' AS designation';
                    }

                    $query = $select . ' FROM ' . $movement_table_sql . ' AS m INNER JOIN ' . $stock_table_sql . ' AS s ON s.'
                        . Sempa_Stocks_DB::escape_identifier($stock_id_column) . ' = m.' . Sempa_Stocks_DB::escape_identifier($movement_product_column)
                        . ' WHERE m.' . Sempa_Stocks_DB::escape_identifier($movement_id_column) . ' = %d';

                    if ($movement_date_column) {
                        $query .= ' ORDER BY m.' . Sempa_Stocks_DB::escape_identifier($movement_date_column) . ' DESC';
                    }

                    $movement = $db->get_row($db->prepare($query, (int) $db->insert_id), ARRAY_A) ?: [];
                }
            }
        }

        $db->query('COMMIT');

        wp_send_json_success([
            'movement' => self::format_movement($movement ?: []),
        ]);
    }

    public static function ajax_export_csv()
    {
        self::ensure_secure_request();
        self::ensure_database_connected();

        self::stream_csv_export();
    }

    public static function stream_csv_export()
    {
        if (!self::current_user_allowed()) {
            wp_die(__('Accès refusé.', 'sempa'), 403);
        }

        $nonce = $_REQUEST['_wpnonce'] ?? '';
        if (!wp_verify_nonce($nonce, self::NONCE_ACTION)) {
            wp_die(__('Nonce invalide.', 'sempa'), 403);
        }

        $db = Sempa_Stocks_DB::instance();

        // Check database connection
        if (!($db instanceof \wpdb) || empty($db->dbh)) {
            wp_die(__('Impossible de se connecter à la base de données.', 'sempa'), 500);
        }

        if (!Sempa_Stocks_DB::table_exists('stocks_sempa')) {
            wp_die(__('La table des stocks est indisponible.', 'sempa'), 500);
        }

        $stock_table = Sempa_Stocks_DB::table('stocks_sempa');
        $order_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'designation', false) ?: Sempa_Stocks_DB::resolve_column('stocks_sempa', 'reference', false);
        $query = 'SELECT * FROM ' . Sempa_Stocks_DB::escape_identifier($stock_table);
        if ($order_column) {
            $query .= ' ORDER BY ' . Sempa_Stocks_DB::escape_identifier($order_column) . ' ASC';
        }

        $products = $db->get_results($query, ARRAY_A);

        nocache_headers();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="stocks-sempa-' . date('Ymd-His') . '.csv"');

        $output = fopen('php://output', 'w');
        fputcsv($output, [
            'ID', 'Référence', 'Désignation', 'Catégorie', 'Fournisseur', 'Prix achat', 'Prix vente', 'Stock actuel', 'Stock minimum', 'Stock maximum', 'Emplacement', 'Date entrée', 'Date modification', 'Notes', 'Document', 'Ajouté par',
        ]);

        foreach ($products ?: [] as $product) {
            fputcsv($output, [
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'id', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'reference', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'designation', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'categorie', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'fournisseur', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'prix_achat', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'prix_vente', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'stock_actuel', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'stock_minimum', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'stock_maximum', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'emplacement', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'date_entree', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'date_modification', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'notes', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'document_pdf', ''),
                Sempa_Stocks_DB::value($product, 'stocks_sempa', 'ajoute_par', ''),
            ]);
        }

        fclose($output);
        exit;
    }

    public static function ajax_reference_data()
    {
        self::ensure_secure_request();
        self::ensure_database_connected();

        $db = Sempa_Stocks_DB::instance();
        $categories = [];
        $suppliers = [];

        if (Sempa_Stocks_DB::table_exists('categories_stocks')) {
            $categories_table = Sempa_Stocks_DB::table('categories_stocks');
            $order_column = Sempa_Stocks_DB::resolve_column('categories_stocks', 'nom', false);
            $query = 'SELECT * FROM ' . Sempa_Stocks_DB::escape_identifier($categories_table);
            if ($order_column) {
                $query .= ' ORDER BY ' . Sempa_Stocks_DB::escape_identifier($order_column) . ' ASC';
            }

            $categories = $db->get_results($query, ARRAY_A) ?: [];
        }

        if (Sempa_Stocks_DB::table_exists('fournisseurs_sempa')) {
            $suppliers_table = Sempa_Stocks_DB::table('fournisseurs_sempa');
            $order_column = Sempa_Stocks_DB::resolve_column('fournisseurs_sempa', 'nom', false);
            $query = 'SELECT * FROM ' . Sempa_Stocks_DB::escape_identifier($suppliers_table);
            if ($order_column) {
                $query .= ' ORDER BY ' . Sempa_Stocks_DB::escape_identifier($order_column) . ' ASC';
            }

            $suppliers = $db->get_results($query, ARRAY_A) ?: [];
        }

        wp_send_json_success([
            'categories' => array_map([__CLASS__, 'format_category'], $categories ?: []),
            'suppliers' => array_map([__CLASS__, 'format_supplier'], $suppliers ?: []),
        ]);
    }

    public static function ajax_save_category()
    {
        self::ensure_secure_request();
        self::ensure_database_connected();
        $name = isset($_POST['nom']) ? sanitize_text_field(wp_unslash($_POST['nom'])) : '';
        $color_input = $_POST['couleur'] ?? '#f4a412';
        $color = sanitize_hex_color($color_input);
        if (!$color) {
            $color = '#f4a412';
        }
        $icon = isset($_POST['icone']) ? sanitize_text_field(wp_unslash($_POST['icone'])) : '';

        if ($name === '') {
            wp_send_json_error(['message' => __('Le nom de la catégorie est obligatoire.', 'sempa')], 400);
        }

        $db = Sempa_Stocks_DB::instance();

        // Check database connection
        if (!($db instanceof \wpdb) || empty($db->dbh)) {
            wp_send_json_error(['message' => __('Impossible de se connecter à la base de données.', 'sempa')], 500);
        }

        if (!Sempa_Stocks_DB::table_exists('categories_stocks')) {
            wp_send_json_error(['message' => __('La table des catégories est indisponible.', 'sempa')], 500);
        }

        $table = Sempa_Stocks_DB::table('categories_stocks');
        $payload = Sempa_Stocks_DB::normalize_columns('categories_stocks', [
            'nom' => $name,
            'couleur' => $color,
            'icone' => $icon,
        ]);

        if (empty($payload)) {
            wp_send_json_error(['message' => __('Aucune donnée valide à enregistrer.', 'sempa')], 400);
        }

        $inserted = $db->insert($table, $payload);

        if ($inserted === false) {
            wp_send_json_error(['message' => $db->last_error ?: __('Impossible d\'ajouter la catégorie.', 'sempa')], 500);
        }

        $id_column = Sempa_Stocks_DB::resolve_column('categories_stocks', 'id', false) ?: 'id';
        $category_data = $payload;
        $category_data[$id_column] = (int) $db->insert_id;

        wp_send_json_success([
            'category' => self::format_category($category_data),
        ]);
    }

    public static function ajax_save_supplier()
    {
        self::ensure_secure_request();
        self::ensure_database_connected();

        $data = self::read_request_body();
        $name = sanitize_text_field($data['nom'] ?? '');
        $contact = sanitize_text_field($data['contact'] ?? '');
        $telephone = sanitize_text_field($data['telephone'] ?? '');
        $email = sanitize_email($data['email'] ?? '');

        if ($name === '') {
            wp_send_json_error(['message' => __('Le nom du fournisseur est obligatoire.', 'sempa')], 400);
        }

        $db = Sempa_Stocks_DB::instance();

        // Check database connection
        if (!($db instanceof \wpdb) || empty($db->dbh)) {
            wp_send_json_error(['message' => __('Impossible de se connecter à la base de données.', 'sempa')], 500);
        }

        if (!Sempa_Stocks_DB::table_exists('fournisseurs_sempa')) {
            wp_send_json_error(['message' => __('La table des fournisseurs est indisponible.', 'sempa')], 500);
        }

        $table = Sempa_Stocks_DB::table('fournisseurs_sempa');
        $payload = Sempa_Stocks_DB::normalize_columns('fournisseurs_sempa', [
            'nom' => $name,
            'contact' => $contact,
            'telephone' => $telephone,
            'email' => $email,
        ]);

        if (empty($payload)) {
            wp_send_json_error(['message' => __('Aucune donnée valide à enregistrer.', 'sempa')], 400);
        }

        $inserted = $db->insert($table, $payload);

        if ($inserted === false) {
            wp_send_json_error(['message' => $db->last_error ?: __('Impossible d\'ajouter le fournisseur.', 'sempa')], 500);
        }

        $id_column = Sempa_Stocks_DB::resolve_column('fournisseurs_sempa', 'id', false) ?: 'id';
        $supplier_data = $payload;
        $supplier_data[$id_column] = (int) $db->insert_id;

        wp_send_json_success([
            'supplier' => self::format_supplier($supplier_data),
        ]);
    }

    private static function ensure_secure_request()
    {
        if (!self::current_user_allowed()) {
            wp_send_json_error(['message' => __('Authentification requise.', 'sempa')], 403);
        }

        check_ajax_referer(self::NONCE_ACTION, 'nonce');
    }

    private static function current_user_allowed()
    {
        if (!is_user_logged_in()) {
            return false;
        }

        $user = wp_get_current_user();
        $allowed = apply_filters('sempa_stock_allowed_emails', [
            'victorfaucher@sempa.fr',
            'jean-baptiste@sempa.fr',
            'valerie@sempa.fr',
        ]);

        $allowed = array_map('strtolower', $allowed);
        return in_array(strtolower($user->user_email), $allowed, true);
    }

    private static function read_request_body()
    {
        if (!empty($_POST)) {
            return wp_unslash($_POST);
        }

        $body = file_get_contents('php://input');
        if (!$body) {
            return [];
        }

        $decoded = json_decode($body, true);
        return is_array($decoded) ? $decoded : [];
    }

    private static function sanitize_decimal($value)
    {
        $value = is_string($value) ? str_replace(',', '.', $value) : $value;
        return (float) $value;
    }

    private static function sanitize_date(string $value)
    {
        if ($value === '') {
            return '';
        }

        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return wp_date('Y-m-d');
        }

        return wp_date('Y-m-d', $timestamp);
    }

    private static function maybe_handle_upload(int $product_id)
    {
        if (empty($_FILES['document'])) {
            return null;
        }

        $file = $_FILES['document'];
        if (!empty($file['error']) || empty($file['tmp_name'])) {
            return null;
        }

        if (!is_uploaded_file($file['tmp_name'])) {
            wp_send_json_error(['message' => __('Fichier uploadé invalide.', 'sempa')], 400);
        }

        $allowed = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($extension, $allowed, true)) {
            wp_send_json_error(['message' => __('Type de fichier non autorisé.', 'sempa')], 400);
        }

        $directory = trailingslashit(get_stylesheet_directory()) . 'uploads-stocks';
        if (!wp_mkdir_p($directory)) {
            wp_send_json_error(['message' => __('Impossible de créer le dossier d\'upload.', 'sempa')], 500);
        }

        $slug = sanitize_title(pathinfo($file['name'], PATHINFO_FILENAME));
        $filename = $slug ? $slug : 'document-stock';
        if ($product_id > 0) {
            $filename .= '-' . $product_id;
        }
        $filename .= '-' . time() . '.' . $extension;

        $destination = trailingslashit($directory) . $filename;
        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            wp_send_json_error(['message' => __('Impossible d\'enregistrer le fichier.', 'sempa')], 500);
        }

        return 'uploads-stocks/' . $filename;
    }

    private static function format_product(array $product)
    {
        if (!$product) {
            return [];
        }

        return [
            'id' => (int) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'id', 0),
            'reference' => (string) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'reference', ''),
            'designation' => (string) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'designation', ''),
            'categorie' => (string) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'categorie', ''),
            'fournisseur' => (string) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'fournisseur', ''),
            'etat_materiel' => (string) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'etat_materiel', 'neuf'),
            'prix_achat' => (float) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'prix_achat', 0),
            'prix_vente' => (float) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'prix_vente', 0),
            'stock_actuel' => (int) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'stock_actuel', 0),
            'stock_minimum' => (int) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'stock_minimum', 0),
            'stock_maximum' => (int) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'stock_maximum', 0),
            'emplacement' => (string) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'emplacement', ''),
            'date_entree' => (string) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'date_entree', ''),
            'date_modification' => (string) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'date_modification', ''),
            'notes' => (string) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'notes', ''),
            'document_pdf' => (string) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'document_pdf', ''),
            'ajoute_par' => (string) Sempa_Stocks_DB::value($product, 'stocks_sempa', 'ajoute_par', ''),
        ];
    }

    private static function format_alert(array $alert)
    {
        return [
            'id' => (int) Sempa_Stocks_DB::value($alert, 'stocks_sempa', 'id', 0),
            'reference' => (string) Sempa_Stocks_DB::value($alert, 'stocks_sempa', 'reference', ''),
            'designation' => (string) Sempa_Stocks_DB::value($alert, 'stocks_sempa', 'designation', ''),
            'stock_actuel' => (int) Sempa_Stocks_DB::value($alert, 'stocks_sempa', 'stock_actuel', 0),
            'stock_minimum' => (int) Sempa_Stocks_DB::value($alert, 'stocks_sempa', 'stock_minimum', 0),
        ];
    }

    private static function format_movement(array $movement)
    {
        return [
            'id' => (int) Sempa_Stocks_DB::value($movement, 'mouvements_stocks_sempa', 'id', 0),
            'produit_id' => (int) Sempa_Stocks_DB::value($movement, 'mouvements_stocks_sempa', 'produit_id', 0),
            'type_mouvement' => (string) Sempa_Stocks_DB::value($movement, 'mouvements_stocks_sempa', 'type_mouvement', ''),
            'quantite' => (int) Sempa_Stocks_DB::value($movement, 'mouvements_stocks_sempa', 'quantite', 0),
            'ancien_stock' => Sempa_Stocks_DB::value($movement, 'mouvements_stocks_sempa', 'ancien_stock', null) !== null ? (int) Sempa_Stocks_DB::value($movement, 'mouvements_stocks_sempa', 'ancien_stock', 0) : null,
            'nouveau_stock' => Sempa_Stocks_DB::value($movement, 'mouvements_stocks_sempa', 'nouveau_stock', null) !== null ? (int) Sempa_Stocks_DB::value($movement, 'mouvements_stocks_sempa', 'nouveau_stock', 0) : null,
            'motif' => (string) Sempa_Stocks_DB::value($movement, 'mouvements_stocks_sempa', 'motif', ''),
            'utilisateur' => (string) Sempa_Stocks_DB::value($movement, 'mouvements_stocks_sempa', 'utilisateur', ''),
            'date_mouvement' => (string) Sempa_Stocks_DB::value($movement, 'mouvements_stocks_sempa', 'date_mouvement', ''),
            'reference' => (string) Sempa_Stocks_DB::value($movement, 'stocks_sempa', 'reference', ''),
            'designation' => (string) Sempa_Stocks_DB::value($movement, 'stocks_sempa', 'designation', ''),
        ];
    }

    private static function format_category(array $category)
    {
        return [
            'id' => (int) Sempa_Stocks_DB::value($category, 'categories_stocks', 'id', 0),
            'nom' => (string) Sempa_Stocks_DB::value($category, 'categories_stocks', 'nom', ''),
            'couleur' => (string) Sempa_Stocks_DB::value($category, 'categories_stocks', 'couleur', '#f4a412'),
            'icone' => (string) Sempa_Stocks_DB::value($category, 'categories_stocks', 'icone', ''),
        ];
    }

    private static function format_supplier(array $supplier)
    {
        return [
            'id' => (int) Sempa_Stocks_DB::value($supplier, 'fournisseurs_sempa', 'id', 0),
            'nom' => (string) Sempa_Stocks_DB::value($supplier, 'fournisseurs_sempa', 'nom', ''),
            'contact' => (string) Sempa_Stocks_DB::value($supplier, 'fournisseurs_sempa', 'contact', ''),
            'telephone' => (string) Sempa_Stocks_DB::value($supplier, 'fournisseurs_sempa', 'telephone', ''),
            'email' => (string) Sempa_Stocks_DB::value($supplier, 'fournisseurs_sempa', 'email', ''),
        ];
    }

    public static function user_is_allowed()
    {
        return self::current_user_allowed();
    }

    public static function nonce()
    {
        if (!self::$nonce_value) {
            self::$nonce_value = wp_create_nonce(self::NONCE_ACTION);
        }

        return self::$nonce_value;
    }

    private static function is_stocks_template()
    {
        if (is_admin()) {
            return false;
        }

        if (is_page_template(['stocks.php', 'page-templates/stocks.php'])) {
            return true;
        }

        if (is_singular('page')) {
            $page_id = get_queried_object_id();
            $template = $page_id ? get_page_template_slug($page_id) : '';

            if ($template && basename($template) === 'stocks.php') {
                return true;
            }

            $slug = $page_id ? get_post_field('post_name', $page_id) : '';
            if ($slug && in_array($slug, ['stocks', 'gestion-stocks', 'gestion-stocks-sempa', 'app-gestion-stocks', 'stock-management'], true)) {
                return true;
            }
        }

        return false;
    }
}

final class Sempa_Stocks_Login
{
    public static function register()
    {
        add_action('login_enqueue_scripts', [__CLASS__, 'enqueue_styles']);
        add_filter('login_message', [__CLASS__, 'login_message']);
        add_filter('login_headerurl', [__CLASS__, 'login_url']);
        add_filter('login_headertext', [__CLASS__, 'login_title']);
    }

    public static function enqueue_styles()
    {
        $css = 'body.login {background: #f8f8f8;} .login h1 a {background-image: none !important; font-size: 32px; font-weight: 700; color: #f4a412 !important; text-indent: 0; width: auto;} .login form {border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #f4a41233;} .login #backtoblog a, .login #nav a {color: #f4a412;} .wp-core-ui .button-primary {background: #f4a412; border-color: #f4a412; text-shadow: none; box-shadow: none;} .wp-core-ui .button-primary:hover {background: #d98f0f; border-color: #d98f0f;} .login-message {text-align: center; background: #ffffff; padding: 16px; border-radius: 8px; border-left: 4px solid #f4a412; color: #333;}';
        wp_enqueue_style('sempa-login-styles', false);
        wp_add_inline_style('sempa-login-styles', $css);
    }

    public static function login_message($message)
    {
        $greeting = '<p class="login-message">' . esc_html__('Bienvenue sur la plateforme de gestion des stocks SEMPA. Connectez-vous avec vos identifiants WordPress pour accéder à l\'application.', 'sempa') . '</p>';
        return $greeting . $message;
    }

    public static function login_url()
    {
        return home_url('/stock-pilot');
    }

    public static function login_title()
    {
        return 'SEMPA';
    }
}

/**
 * Gère les redirections pour l'accès à l'application de gestion des stocks
 *
 * @since 2.0.0
 */
final class Sempa_Login_Redirect
{
    /**
     * Enregistre les hooks nécessaires pour gérer les redirections
     */
    public static function register()
    {
        add_action('template_redirect', [__CLASS__, 'handle_stock_pilot_redirect']);
        add_filter('login_redirect', [__CLASS__, 'redirect_after_login'], 10, 3);
    }

    /**
     * Redirige l'ancienne URL /stocks vers la nouvelle /stock-pilot
     * Corrige le problème de redirection pour les ayants droits
     */
    public static function handle_stock_pilot_redirect()
    {
        // Récupérer l'URI de la requête
        $request_uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';

        // Nettoyer l'URI (enlever les query strings)
        $path = parse_url($request_uri, PHP_URL_PATH);

        // Normaliser le chemin (enlever les slashes de début et fin)
        $path = trim($path, '/');

        // Rediriger l'ancienne URL /stocks vers la nouvelle /stock-pilot
        if ($path === 'stocks' || strpos($path, 'stocks/') === 0) {
            wp_safe_redirect(home_url('/stock-pilot/'), 301);
            exit;
        }

        // Alternative : vérifier aussi si WordPress détecte la page stocks
        if (is_page('stocks')) {
            wp_safe_redirect(home_url('/stock-pilot/'), 301);
            exit;
        }
    }

    /**
     * Redirige les utilisateurs autorisés vers la page de stocks après connexion
     *
     * @param string $redirect_to URL de redirection
     * @param string $request URL demandée
     * @param WP_User|WP_Error $user Utilisateur connecté
     * @return string URL de redirection finale
     */
    public static function redirect_after_login($redirect_to, $request, $user)
    {
        // Si l'utilisateur n'est pas valide, ne pas modifier la redirection
        if (!($user instanceof WP_User) || !$user->exists()) {
            return $redirect_to;
        }

        // Vérifier si l'utilisateur a les permissions pour gérer les stocks
        if (self::user_can_manage_stock($user)) {
            // Rediriger vers la page stock-pilot
            return home_url('/stock-pilot/');
        }

        return $redirect_to;
    }

    /**
     * Vérifie si l'utilisateur peut gérer les stocks
     *
     * @param WP_User $user Utilisateur à vérifier
     * @return bool True si l'utilisateur peut gérer les stocks
     */
    private static function user_can_manage_stock($user)
    {
        if (!($user instanceof WP_User)) {
            return false;
        }

        // Administrateur ou gestionnaire de stock
        if (user_can($user, 'manage_options') || user_can($user, 'manage_sempa_stock')) {
            return true;
        }

        // Rôle spécifique gestionnaire de stock
        if (in_array('gestionnaire_de_stock', (array) $user->roles, true)) {
            return true;
        }

        return false;
    }
}
