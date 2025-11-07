<?php
if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('Sempa_Order_Stock_Sync')) {
    final class Sempa_Order_Stock_Sync
    {
        /**
         * Synchronise les stocks "StockPilot" lors d'une commande express.
         *
         * @param array $products Liste brute des produits envoyés par le front.
         * @param array $context  Métadonnées de la commande (nom client, numéro, etc.).
         *
         * @return true|WP_Error
         */
        public static function sync(array $products, array $context = [])
        {
            if (empty($products) || !class_exists('Sempa_Stocks_DB')) {
                return true;
            }

            try {
                $db = Sempa_Stocks_DB::instance();
            } catch (Throwable $exception) {
                if (function_exists('error_log')) {
                    error_log('[Sempa] Stock sync connection failure: ' . $exception->getMessage());
                }

                return new WP_Error(
                    'stocks_connection_failed',
                    __('Impossible de se connecter à la base de données des stocks.', 'sempa')
                );
            }

            if (!($db instanceof wpdb)) {
                return new WP_Error(
                    'stocks_connection_failed',
                    __('Connexion à la base de données des stocks indisponible.', 'sempa')
                );
            }

            $stock_schema = self::resolve_stock_schema();
            if (is_wp_error($stock_schema)) {
                if (function_exists('error_log')) {
                    error_log('[Sempa] Stock schema unavailable: ' . $stock_schema->get_error_message());
                }

                return true;
            }

            $transaction_started = false;
            try {
                $start_result = $db->query('START TRANSACTION');
                $transaction_started = ($start_result !== false);
            } catch (Throwable $exception) {
                if (function_exists('error_log')) {
                    error_log('[Sempa] Unable to start stock transaction: ' . $exception->getMessage());
                }
            }

            foreach ($products as $product) {
                try {
                    $result = self::synchronize_product($db, $product, $context, $stock_schema);
                } catch (Throwable $exception) {
                    if ($transaction_started) {
                        $db->query('ROLLBACK');
                    }

                    $exception_message = $exception->getMessage();
                    if (function_exists('error_log')) {
                        error_log('[Sempa] Stock sync failure: ' . $exception_message);
                    }

                    $clean_message = function_exists('wp_strip_all_tags')
                        ? wp_strip_all_tags($exception_message)
                        : $exception_message;

                    return new WP_Error(
                        'stocks_sync_failed',
                        sprintf(
                            __('Impossible de synchroniser les stocks : %s', 'sempa'),
                            $clean_message
                        )
                    );
                }

                if (is_wp_error($result)) {
                    if ($transaction_started) {
                        $db->query('ROLLBACK');
                    }

                    return $result;
                }
            }

            if ($transaction_started) {
                $db->query('COMMIT');
            }

            return true;
        }

        private static function synchronize_product(\wpdb $db, $raw_product, array $context, array $stock_schema)
        {
            if (is_object($raw_product)) {
                $raw_product = (array) $raw_product;
            }

            if (!is_array($raw_product)) {
                return new WP_Error('invalid_product', __('Produit de commande invalide.', 'sempa'));
            }

            $product = array_map(function ($value) {
                return is_string($value) ? wp_unslash($value) : $value;
            }, $raw_product);

            $product_id = self::extract_product_id($product);
            $quantity = self::extract_quantity($product);

            if ($product_id <= 0 || $quantity <= 0) {
                return true;
            }

            $stock_table = $stock_schema['table'];
            $id_column = $stock_schema['id'];
            $stock_column = $stock_schema['stock'];

            $row = $db->get_row(
                $db->prepare(
                    'SELECT * FROM ' . Sempa_Stocks_DB::escape_identifier($stock_table) . ' WHERE ' . Sempa_Stocks_DB::escape_identifier($id_column) . ' = %d',
                    $product_id
                ),
                ARRAY_A
            );

            if (!$row) {
                $label = $product['name'] ?? $product['designation'] ?? ('#' . $product_id);

                return new WP_Error(
                    'stock_product_missing',
                    sprintf(
                        __('Le produit "%s" est introuvable dans la base de stocks.', 'sempa'),
                        sanitize_text_field($label)
                    )
                );
            }

            $current_stock = (int) ($row[$stock_column] ?? 0);
            $new_stock = $current_stock - $quantity;
            $had_shortage = $new_stock < 0;
            if ($had_shortage) {
                $new_stock = 0;
            }

            $update_data = [
                $stock_column => $new_stock,
            ];
            $update_formats = ['%d'];

            if (!empty($stock_schema['modified'])) {
                $update_data[$stock_schema['modified']] = current_time('mysql');
                $update_formats[] = '%s';
            }

            $updated = $db->update(
                $stock_table,
                $update_data,
                [$id_column => $product_id],
                $update_formats,
                ['%d']
            );

            if ($updated === false) {
                return new WP_Error(
                    'stock_update_failed',
                    $db->last_error ?: __('Impossible de mettre à jour le stock.', 'sempa')
                );
            }

            $movement_result = self::record_movement(
                $db,
                $product_id,
                $quantity,
                $current_stock,
                $new_stock,
                $had_shortage,
                $row,
                $product,
                $context
            );

            if (is_wp_error($movement_result)) {
                return $movement_result;
            }

            return true;
        }

        private static function record_movement(\wpdb $db, int $product_id, int $quantity, int $previous_stock, int $new_stock, bool $had_shortage, array $stock_row, array $product, array $context)
        {
            $movement_reason = self::build_reason($quantity, $previous_stock, $new_stock, $had_shortage, $stock_row, $product, $context);

            $movement_data = [];
            $movement_formats = [];

            $mapping = [
                'produit_id' => [$product_id, '%d'],
                'type_mouvement' => ['sortie', '%s'],
                'quantite' => [$quantity, '%d'],
                'ancien_stock' => [$previous_stock, '%d'],
                'nouveau_stock' => [$new_stock, '%d'],
                'motif' => [$movement_reason, '%s'],
                'utilisateur' => [self::resolve_user($context), '%s'],
            ];

            foreach ($mapping as $column => $payload) {
                $resolved = Sempa_Stocks_DB::resolve_column('mouvements_stocks_sempa', $column, false);
                if ($resolved === null) {
                    continue;
                }

                $movement_data[$resolved] = $payload[0];
                $movement_formats[] = $payload[1];
            }

            if (empty($movement_data)) {
                return true;
            }

            $movement_table = Sempa_Stocks_DB::table('mouvements_stocks_sempa');
            $inserted = $db->insert($movement_table, $movement_data, $movement_formats);

            if ($inserted === false) {
                return new WP_Error(
                    'stock_movement_failed',
                    $db->last_error ?: __('Impossible d\'enregistrer le mouvement de stock.', 'sempa')
                );
            }

            return true;
        }

        private static function extract_product_id(array $product): int
        {
            foreach (['product_id', 'id', 'productId', 'produit_id'] as $key) {
                if (isset($product[$key]) && (int) $product[$key] > 0) {
                    return (int) $product[$key];
                }
            }

            return 0;
        }

        private static function extract_quantity(array $product): int
        {
            foreach (['quantity', 'qty', 'quantite', 'quantité'] as $key) {
                if (isset($product[$key]) && (int) $product[$key] > 0) {
                    return absint($product[$key]);
                }
            }

            return 0;
        }

        private static function build_reason(int $quantity, int $previous_stock, int $new_stock, bool $had_shortage, array $stock_row, array $product, array $context): string
        {
            $parts = [];

            $order_reference = $context['order_number'] ?? $context['order_id'] ?? '';
            if ($order_reference !== '') {
                $parts[] = sprintf(__('Commande Express %s', 'sempa'), sanitize_text_field($order_reference));
            } else {
                $parts[] = __('Commande Express', 'sempa');
            }

            if (!empty($context['order_date'])) {
                $parts[] = sanitize_text_field($context['order_date']);
            }

            if (!empty($context['client_name'])) {
                $parts[] = sanitize_text_field($context['client_name']);
            }

            $designation = $product['name'] ?? $product['designation'] ?? Sempa_Stocks_DB::value($stock_row, 'stocks_sempa', 'designation', '');
            if ($designation !== '') {
                $parts[] = sanitize_text_field($designation);
            }

            $reference = $product['reference'] ?? Sempa_Stocks_DB::value($stock_row, 'stocks_sempa', 'reference', '');
            if ($reference !== '') {
                $parts[] = sprintf(__('Ref. %s', 'sempa'), sanitize_text_field($reference));
            }

            $parts[] = sprintf(__('Qté: %d (stock %d → %d)', 'sempa'), $quantity, $previous_stock, $new_stock);

            if ($had_shortage) {
                $parts[] = __('Stock insuffisant, ajustement à 0.', 'sempa');
            }

            return implode(' | ', array_filter($parts));
        }

        private static function resolve_user(array $context): string
        {
            if (!empty($context['user_email'])) {
                $email = sanitize_email($context['user_email']);
                if ($email !== '') {
                    return $email;
                }
            }

            if (!empty($context['client_email'])) {
                $email = sanitize_email($context['client_email']);
                if ($email !== '') {
                    return $email;
                }
            }

            return 'commande-express@sempa.fr';
        }

        private static function resolve_stock_schema()
        {
            static $schema = null;

            if ($schema instanceof WP_Error || is_array($schema)) {
                return $schema;
            }

            $id_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'id', false);
            $stock_column = Sempa_Stocks_DB::resolve_column('stocks_sempa', 'stock_actuel', false);
            $table = Sempa_Stocks_DB::table('stocks_sempa');

            if (!$table || !$id_column || !$stock_column) {
                $schema = new WP_Error(
                    'stock_schema_invalid',
                    __('Structure de la table des stocks invalide.', 'sempa')
                );

                return $schema;
            }

            $schema = [
                'table' => $table,
                'id' => $id_column,
                'stock' => $stock_column,
                'modified' => Sempa_Stocks_DB::resolve_column('stocks_sempa', 'date_modification', false),
            ];

            return $schema;
        }
    }
}