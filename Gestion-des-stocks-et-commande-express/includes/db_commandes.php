<?php
if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/db_connect_stocks.php';
require_once __DIR__ . '/functions_commandes.php';

if (!class_exists('Sempa_Order_Manager')) {
    final class Sempa_Order_Manager
    {
        private const DB_HOST = 'db5001643902.hosting-data.io';
        private const DB_NAME = 'dbs1363734';
        private const DB_USER = 'dbu1662343';
        private const DB_PASSWORD = '14Juillet@';
        private const DB_PORT = 3306;

        private static $instance = null;

        /**
         * Get wpdb instance for orders database
         */
        public static function instance()
        {
            if (self::$instance instanceof \wpdb) {
                return self::$instance;
            }

            if (!class_exists('wpdb')) {
                require_once ABSPATH . 'wp-includes/wp-db.php';
            }

            $wpdb = new \wpdb(self::DB_USER, self::DB_PASSWORD, self::DB_NAME, self::DB_HOST, self::DB_PORT);
            $wpdb->show_errors(false);

            if (!empty($wpdb->dbh)) {
                $wpdb->set_charset($wpdb->dbh, 'utf8mb4');
            }

            self::$instance = $wpdb;

            return self::$instance;
        }

        /**
         * Register WordPress hooks
         */
        public static function register()
        {
            add_action('rest_api_init', [__CLASS__, 'register_rest_routes']);
        }

        /**
         * Register REST API routes
         */
        public static function register_rest_routes()
        {
            register_rest_route('sempa/v1', '/commande', [
                'methods' => 'POST',
                'callback' => [__CLASS__, 'handle_order_submission'],
                'permission_callback' => '__return_true', // Public endpoint
            ]);
        }

        /**
         * Handle order submission via REST API
         */
        public static function handle_order_submission(\WP_REST_Request $request)
        {
            try {
                $data = $request->get_json_params();

                // Validate required fields
                $validation_error = self::validate_order_data($data);
                if ($validation_error) {
                    return new \WP_Error('invalid_data', $validation_error, ['status' => 400]);
                }

                // Start transaction
                $db = self::instance();
                if (!($db instanceof \wpdb) || empty($db->dbh)) {
                    return new \WP_Error('database_error', __('Connexion à la base de données impossible.', 'sempa'), ['status' => 500]);
                }

                $db->query('START TRANSACTION');

                try {
                    // Insert order into commandes table
                    $order_id = self::insert_order($db, $data);

                    if (!$order_id) {
                        throw new \Exception($db->last_error ?: __('Impossible de créer la commande.', 'sempa'));
                    }

                    $order_reference = 'CMD-' . date('Ymd') . '-' . $order_id;

                    // Sync stock using Sempa_Order_Stock_Sync
                    if (class_exists('Sempa_Order_Stock_Sync')) {
                        $context = [
                            'order_id' => $order_id,
                            'order_number' => $order_reference,
                            'order_date' => $data['date_commande'] ?? date('Y-m-d'),
                            'client_name' => $data['nom_societe'] ?? '',
                            'client_email' => $data['email'] ?? '',
                        ];

                        $sync_result = Sempa_Order_Stock_Sync::sync($data['produits'] ?? [], $context);

                        if (is_wp_error($sync_result)) {
                            throw new \Exception($sync_result->get_error_message());
                        }
                    }

                    // Commit transaction
                    $db->query('COMMIT');

                    return new \WP_REST_Response([
                        'success' => true,
                        'message' => __('Commande enregistrée avec succès.', 'sempa'),
                        'orderRef' => $order_reference,
                        'orderId' => $order_id,
                    ], 200);

                } catch (\Exception $e) {
                    $db->query('ROLLBACK');
                    throw $e;
                }

            } catch (\Exception $e) {
                error_log('[Sempa Order] Error: ' . $e->getMessage());
                return new \WP_Error('order_error', $e->getMessage(), ['status' => 500]);
            }
        }

        /**
         * Validate order data
         */
        private static function validate_order_data($data)
        {
            $required_fields = ['nom_societe', 'email', 'telephone', 'code_postal', 'ville', 'date_commande'];

            foreach ($required_fields as $field) {
                if (empty($data[$field])) {
                    return sprintf(__('Le champ "%s" est obligatoire.', 'sempa'), $field);
                }
            }

            if (empty($data['produits']) || !is_array($data['produits'])) {
                return __('Aucun produit dans la commande.', 'sempa');
            }

            if (!is_email($data['email'])) {
                return __('Email invalide.', 'sempa');
            }

            return null;
        }

        /**
         * Insert order into commandes table
         */
        private static function insert_order(\wpdb $db, array $data)
        {
            $order_data = [
                'nom_societe' => sanitize_text_field($data['nom_societe']),
                'email' => sanitize_email($data['email']),
                'telephone' => sanitize_text_field($data['telephone']),
                'numero_client' => sanitize_text_field($data['numero_client'] ?? ''),
                'code_postal' => sanitize_text_field($data['code_postal']),
                'ville' => sanitize_text_field($data['ville']),
                'date_commande' => sanitize_text_field($data['date_commande']),
                'details_produits' => wp_json_encode($data['produits'] ?? []),
                'sous_total' => floatval($data['sous_total'] ?? 0),
                'frais_livraison' => floatval($data['frais_livraison'] ?? 0),
                'tva' => floatval($data['tva'] ?? 0),
                'total_ttc' => floatval($data['total_ttc'] ?? 0),
                'instructions_speciales' => sanitize_textarea_field($data['instructions_speciales'] ?? ''),
                'confirmation_email' => !empty($data['confirmation_email']) ? 1 : 0,
                'date_creation' => current_time('mysql'),
            ];

            $formats = [
                '%s', // nom_societe
                '%s', // email
                '%s', // telephone
                '%s', // numero_client
                '%s', // code_postal
                '%s', // ville
                '%s', // date_commande
                '%s', // details_produits
                '%f', // sous_total
                '%f', // frais_livraison
                '%f', // tva
                '%f', // total_ttc
                '%s', // instructions_speciales
                '%d', // confirmation_email
                '%s', // date_creation
            ];

            $inserted = $db->insert('commandes', $order_data, $formats);

            if ($inserted === false) {
                return false;
            }

            return $db->insert_id;
        }
    }
}
