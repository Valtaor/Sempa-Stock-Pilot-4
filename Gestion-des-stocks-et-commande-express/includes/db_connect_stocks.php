<?php
if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('Sempa_Stocks_DB')) {
    final class Sempa_Stocks_DB
    {
        private const DB_HOST = 'db5001643902.hosting-data.io';
        private const DB_NAME = 'dbs1363734';
        private const DB_USER = 'dbu1662343';
        private const DB_PASSWORD = '14Juillet@';
        private const DB_PORT = 3306;

        private const TABLE_ALIASES = [
            'stocks_sempa' => ['stocks_sempa', 'stocks', 'products'],
            'mouvements_stocks_sempa' => ['mouvements_stocks_sempa', 'stock_movements', 'movements'],
            'categories_stocks' => ['categories_stocks', 'stock_categories', 'product_categories'],
            'fournisseurs_sempa' => ['fournisseurs', 'fournisseurs_sempa', 'stock_suppliers', 'suppliers'],
        ];

        private const COLUMN_ALIASES = [
            'stocks_sempa' => [
                'id' => ['id'],
                'product_id' => ['id', 'product_id'],
                'designation' => ['designation', 'name', 'nom'],
                'name' => ['name', 'designation'],
                'reference' => ['reference', 'sku'],
                'stock' => ['stock', 'stock_actuel'],
                'stock_actuel' => ['stock_actuel', 'stock'],
                'stock_minimum' => ['stock_minimum', 'minstock', 'min_stock', 'minStock'],
                'stock_maximum' => ['stock_maximum', 'maxstock', 'max_stock', 'maxStock'],
                'prix_achat' => ['prix_achat', 'purchase_price', 'purchaseprice', 'purchasePrice'],
                'prix_vente' => ['prix_vente', 'sale_price', 'saleprice', 'salePrice'],
                'categorie' => ['categorie', 'category'],
                'fournisseur' => ['fournisseur', 'supplier', 'supplier_name'],
                'emplacement' => ['emplacement', 'location'],
                'date_entree' => ['date_entree', 'date_entree_stock', 'date_added', 'created_at'],
                'date_modification' => ['date_modification', 'modified', 'updated_at', 'lastUpdated'],
                'notes' => ['notes', 'description'],
                'document_pdf' => ['document_pdf', 'document', 'document_url', 'imageUrl'],
                'ajoute_par' => ['ajoute_par', 'added_by', 'created_by'],
                'prix_achat_total' => ['prix_achat_total', 'total_purchase'],
                'etat_materiel' => ['etat_materiel', 'material_state', 'condition'],
            ],
            'mouvements_stocks_sempa' => [
                'id' => ['id'],
                'produit_id' => ['produit_id', 'product_id', 'productId'],
                'product_id' => ['product_id', 'produit_id', 'productId'],
                'type' => ['type', 'movement_type', 'type_mouvement'],
                'type_mouvement' => ['type_mouvement', 'type', 'movement_type'],
                'quantite' => ['quantite', 'quantity'],
                'quantity' => ['quantity', 'quantite'],
                'ancien_stock' => ['ancien_stock', 'previous_stock', 'stock_before'],
                'nouveau_stock' => ['nouveau_stock', 'new_stock', 'stock_after'],
                'motif' => ['motif', 'reason'],
                'utilisateur' => ['utilisateur', 'user', 'user_name'],
                'date_mouvement' => ['date_mouvement', 'date', 'created_at'],
            ],
            'categories_stocks' => [
                'id' => ['id'],
                'nom' => ['nom', 'name'],
                'couleur' => ['couleur', 'color', 'colour'],
                'icone' => ['icone', 'icon'],
            ],
            'fournisseurs_sempa' => [
                'id' => ['id'],
                'nom' => ['nom', 'name'],
                'contact' => ['nom_contact', 'contact', 'contact_name'],
                'nom_contact' => ['nom_contact', 'contact', 'contact_name'],
                'telephone' => ['telephone', 'phone', 'phone_number'],
                'email' => ['email'],
                'date_creation' => ['date_creation', 'created_at', 'date_ajout'],
            ],
        ];

        private static $instance = null;
        private static $table_cache = [];
        private static $columns_cache = [];

        /**
         * Configuration retry logic
         */
        private const MAX_RETRY_ATTEMPTS = 3;
        private const INITIAL_RETRY_DELAY_MS = 1000; // 1 seconde
        private const CONNECTION_TIMEOUT_SEC = 5;
        private const ALERT_EMAIL = 'admin@sempa.fr';

        /**
         * Obtient l'instance de connexion à la base de données avec retry logic
         *
         * @return \wpdb Instance wpdb
         */
        public static function instance()
        {
            if (self::$instance instanceof \wpdb) {
                // Vérifier si la connexion existante est toujours valide
                if (self::is_connected(self::$instance)) {
                    return self::$instance;
                }

                // Connexion perdue, réinitialiser l'instance
                error_log('[SEMPA DB] Connexion perdue, tentative de reconnexion...');
                self::$instance = null;
            }

            require_once ABSPATH . 'wp-includes/wp-db.php';

            // Tentatives de connexion avec retry logic
            $attempt = 0;
            $last_error = '';

            while ($attempt < self::MAX_RETRY_ATTEMPTS) {
                $attempt++;

                try {
                    // Configurer le timeout de connexion
                    ini_set('mysql.connect_timeout', (string) self::CONNECTION_TIMEOUT_SEC);
                    ini_set('default_socket_timeout', (string) self::CONNECTION_TIMEOUT_SEC);

                    // Créer la connexion
                    $wpdb = new \wpdb(self::DB_USER, self::DB_PASSWORD, self::DB_NAME, self::DB_HOST, self::DB_PORT);
                    $wpdb->show_errors(false);

                    // Vérifier la connexion
                    if (!empty($wpdb->dbh)) {
                        $wpdb->set_charset($wpdb->dbh, 'utf8mb4');

                        // Test de connexion avec une requête simple
                        $result = $wpdb->query('SELECT 1');

                        if ($result !== false) {
                            self::$instance = $wpdb;

                            if ($attempt > 1) {
                                error_log("[SEMPA DB] ✓ Connexion réussie après $attempt tentatives");
                            }

                            return self::$instance;
                        }
                    }

                    $last_error = $wpdb->last_error ?: 'Connexion échouée';
                } catch (\Throwable $e) {
                    $last_error = $e->getMessage();
                }

                // Échec de connexion
                error_log("[SEMPA DB] ✗ Tentative $attempt/$" . self::MAX_RETRY_ATTEMPTS . " échouée : $last_error");

                // Attendre avant de réessayer (délai exponentiel)
                if ($attempt < self::MAX_RETRY_ATTEMPTS) {
                    $delay_ms = self::INITIAL_RETRY_DELAY_MS * pow(2, $attempt - 1);
                    usleep($delay_ms * 1000); // Convertir ms en µs
                    error_log("[SEMPA DB] Attente de {$delay_ms}ms avant nouvelle tentative...");
                }
            }

            // Toutes les tentatives ont échoué
            error_log("[SEMPA DB] ✗✗✗ ÉCHEC : Impossible de se connecter après " . self::MAX_RETRY_ATTEMPTS . " tentatives");
            error_log("[SEMPA DB] Dernière erreur : $last_error");

            // Envoyer une alerte email
            self::send_connection_alert($last_error, self::MAX_RETRY_ATTEMPTS);

            // Créer une instance vide pour éviter les erreurs fatales
            self::$instance = new \wpdb(self::DB_USER, self::DB_PASSWORD, self::DB_NAME, self::DB_HOST, self::DB_PORT);

            return self::$instance;
        }

        /**
         * Vérifie si la connexion à la base de données est active
         *
         * @param \wpdb|null $wpdb Instance wpdb à tester (ou null pour tester l'instance courante)
         * @return bool True si connecté
         */
        public static function is_connected($wpdb = null): bool
        {
            if ($wpdb === null) {
                $wpdb = self::$instance;
            }

            if (!($wpdb instanceof \wpdb)) {
                return false;
            }

            if (empty($wpdb->dbh)) {
                return false;
            }

            // Tester avec une requête simple
            try {
                $result = $wpdb->query('SELECT 1');
                return $result !== false;
            } catch (\Throwable $e) {
                error_log('[SEMPA DB] Test de connexion échoué : ' . $e->getMessage());
                return false;
            }
        }

        /**
         * Envoie une alerte email en cas d'échec de connexion
         *
         * @param string $error Dernière erreur rencontrée
         * @param int $attempts Nombre de tentatives
         * @return bool True si l'email a été envoyé
         */
        private static function send_connection_alert(string $error, int $attempts): bool
        {
            $subject = '[SEMPA CRITIQUE] Échec de connexion à la base de données';

            $message = "Une erreur critique s'est produite lors de la connexion à la base de données SEMPA.\n\n";
            $message .= "Détails :\n";
            $message .= "- Date : " . current_time('mysql') . "\n";
            $message .= "- Host : " . self::DB_HOST . "\n";
            $message .= "- Database : " . self::DB_NAME . "\n";
            $message .= "- Tentatives : $attempts\n";
            $message .= "- Dernière erreur : $error\n\n";

            $message .= "Actions recommandées :\n";
            $message .= "1. Vérifier que le serveur MySQL est en ligne\n";
            $message .= "2. Vérifier les credentials de connexion\n";
            $message .= "3. Vérifier les règles de firewall\n";
            $message .= "4. Consulter les logs MySQL : /var/log/mysql/error.log\n";
            $message .= "5. Contacter l'hébergeur si le problème persiste\n\n";

            $message .= "URL du site : " . home_url() . "\n";
            $message .= "Healthcheck : " . home_url('/wp-json/sempa/v1/health') . "\n";

            $headers = ['Content-Type: text/plain; charset=UTF-8'];

            $sent = wp_mail(self::ALERT_EMAIL, $subject, $message, $headers);

            if ($sent) {
                error_log('[SEMPA DB] Alerte email envoyée à ' . self::ALERT_EMAIL);
            } else {
                error_log('[SEMPA DB] ERREUR : Impossible d\'envoyer l\'alerte email');
            }

            return $sent;
        }

        public static function table(string $name)
        {
            $key = strtolower($name);

            if (array_key_exists($key, self::$table_cache)) {
                $cached = self::$table_cache[$key];

                return $cached !== false ? $cached : $name;
            }

            try {
                $db = self::instance();
            } catch (\Throwable $exception) {
                if (function_exists('error_log')) {
                    error_log('[Sempa] Unable to resolve table ' . $name . ': ' . $exception->getMessage());
                }

                self::$table_cache[$key] = false;

                return $name;
            }

            if (!($db instanceof \wpdb) || empty($db->dbh)) {
                if (function_exists('error_log')) {
                    error_log('[Sempa] Database connection not established when resolving table ' . $name);
                }

                self::$table_cache[$key] = false;

                return $name;
            }

            $candidates = self::TABLE_ALIASES[$key] ?? [$name];

            foreach ($candidates as $candidate) {
                $candidate = trim((string) $candidate);

                if ($candidate === '') {
                    continue;
                }

                $found = $db->get_var($db->prepare('SHOW TABLES LIKE %s', $candidate));
                if (!empty($found)) {
                    self::$table_cache[$key] = $found;

                    return $found;
                }
            }

            self::$table_cache[$key] = false;

            return $name;
        }

        public static function escape_identifier(string $identifier): string
        {
            $parts = array_filter(array_map('trim', explode('.', $identifier)));

            if (empty($parts)) {
                return '``';
            }

            $escaped = [];

            foreach ($parts as $part) {
                $clean = preg_replace('/[^A-Za-z0-9_]/', '', $part);
                if ($clean === '') {
                    continue;
                }

                $escaped[] = '`' . $clean . '`';
            }

            if (empty($escaped)) {
                return '``';
            }

            return implode('.', $escaped);
        }

        public static function resolve_column(string $table, string $column, bool $fallback = true)
        {
            $table_key = strtolower($table);
            $column_key = strtolower($column);

            $candidates = [];

            if (isset(self::COLUMN_ALIASES[$table_key][$column_key])) {
                $mapped = self::COLUMN_ALIASES[$table_key][$column_key];
                $candidates = is_array($mapped) ? $mapped : [$mapped];
            }

            $actual_table = self::table($table);
            $columns = self::get_table_columns($actual_table);

            foreach ($candidates as $candidate) {
                $candidate = (string) $candidate;
                if ($candidate === '') {
                    continue;
                }

                if (in_array(strtolower($candidate), $columns, true)) {
                    return $candidate;
                }
            }

            if (in_array($column_key, $columns, true)) {
                return $column;
            }

            return $fallback ? $column : null;
        }

        public static function value($row, string $table, string $column, $default = null)
        {
            if (is_object($row)) {
                $row = (array) $row;
            }

            if (!is_array($row)) {
                return $default;
            }

            $table_key = strtolower($table);
            $column_key = strtolower($column);

            $candidates = [];

            $resolved = self::resolve_column($table, $column, false);
            if ($resolved !== null) {
                $candidates[] = $resolved;
            }

            if (isset(self::COLUMN_ALIASES[$table_key][$column_key])) {
                $mapped = self::COLUMN_ALIASES[$table_key][$column_key];
                $mapped = is_array($mapped) ? $mapped : [$mapped];
                foreach ($mapped as $candidate) {
                    if ($candidate !== null && $candidate !== '') {
                        $candidates[] = $candidate;
                    }
                }
            }

            $candidates[] = $column;

            $checked = [];

            foreach ($candidates as $candidate) {
                $candidate_key = strtolower((string) $candidate);

                if ($candidate_key === '') {
                    continue;
                }

                if (in_array($candidate_key, $checked, true)) {
                    continue;
                }

                $checked[] = $candidate_key;

                foreach ($row as $key => $value) {
                    if (strcasecmp((string) $key, $candidate) === 0) {
                        return $value;
                    }
                }
            }

            return $default;
        }

        public static function normalize_columns(string $table, array $data): array
        {
            $normalized = [];

            foreach ($data as $column => $value) {
                $resolved = self::resolve_column($table, (string) $column, false);

                if ($resolved !== null) {
                    $normalized[$resolved] = $value;
                    continue;
                }

                $actual_table = self::table($table);
                $columns = self::get_table_columns($actual_table);
                $column_key = strtolower((string) $column);

                if (in_array($column_key, $columns, true)) {
                    $normalized[$column] = $value;
                }
            }

            return $normalized;
        }

        public static function table_exists(string $name): bool
        {
            $key = strtolower($name);

            if (!array_key_exists($key, self::$table_cache)) {
                self::table($name);
            }

            return !empty(self::$table_cache[$key]);
        }

        /**
         * Clear all internal caches (table names and column names)
         * Useful after creating or modifying tables
         */
        public static function clear_cache(): void
        {
            self::$table_cache = [];
            self::$columns_cache = [];
        }

        private static function get_table_columns(string $table): array
        {
            $table_key = strtolower($table);

            if (isset(self::$columns_cache[$table_key])) {
                return self::$columns_cache[$table_key];
            }

            if ($table === '' || $table === null) {
                self::$columns_cache[$table_key] = [];

                return [];
            }

            $columns = [];

            try {
                $db = self::instance();
            } catch (\Throwable $exception) {
                if (function_exists('error_log')) {
                    error_log('[Sempa] Unable to inspect table columns for ' . $table . ': ' . $exception->getMessage());
                }

                self::$columns_cache[$table_key] = [];

                return [];
            }

            if (!($db instanceof \wpdb) || empty($db->dbh)) {
                if (function_exists('error_log')) {
                    error_log('[Sempa] Database connection not established when inspecting columns for ' . $table);
                }

                self::$columns_cache[$table_key] = [];

                return [];
            }

            try {
                $results = $db->get_results('SHOW COLUMNS FROM ' . self::escape_identifier($table));

                if (is_array($results)) {
                    foreach ($results as $column) {
                        if (isset($column->Field)) {
                            $columns[] = strtolower((string) $column->Field);
                        }
                    }
                }
            } catch (\Throwable $exception) {
                if (function_exists('error_log')) {
                    error_log('[Sempa] Unable to fetch columns for ' . $table . ': ' . $exception->getMessage());
                }
            }

            self::$columns_cache[$table_key] = $columns;

            return $columns;
        }

        /**
         * Retourne le host de la base de données
         *
         * @return string Host de la base de données
         */
        public static function get_host(): string
        {
            return self::DB_HOST;
        }

        /**
         * Retourne le nom de la base de données
         *
         * @return string Nom de la base de données
         */
        public static function get_database(): string
        {
            return self::DB_NAME;
        }
    }
}
