<?php
if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('Sempa_Stocks_Schema_Setup')) {
    final class Sempa_Stocks_Schema_Setup
    {
        /**
         * Ensure all required tables exist in the database
         * This function will create missing tables automatically
         */
        public static function ensure_schema()
        {
            try {
                self::ensure_suppliers_table();
                self::ensure_products_supplier_column();
                self::ensure_products_etat_materiel_column();
                self::ensure_audit_trail_columns();
            } catch (\Throwable $exception) {
                if (function_exists('error_log')) {
                    error_log('[Sempa] Schema setup error: ' . $exception->getMessage());
                }
            }
        }

        /**
         * Create the suppliers table if it doesn't exist
         */
        private static function ensure_suppliers_table()
        {
            $db = Sempa_Stocks_DB::instance();

            if (!($db instanceof \wpdb) || empty($db->dbh)) {
                error_log('[Sempa] Cannot create suppliers table: database connection not available');
                return false;
            }

            // Check if table already exists using any of the aliases
            if (Sempa_Stocks_DB::table_exists('fournisseurs_sempa')) {
                return true; // Table already exists
            }

            // Create the suppliers table (fournisseurs)
            $sql = "CREATE TABLE IF NOT EXISTS `fournisseurs` (
                `id` int(11) NOT NULL AUTO_INCREMENT,
                `nom` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
                `nom_contact` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                `telephone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
                `date_creation` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `nom_unique` (`nom`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

            $result = $db->query($sql);

            if ($result === false) {
                error_log('[Sempa] Failed to create suppliers table: ' . $db->last_error);
                return false;
            }

            // Clear the table cache to force re-detection
            Sempa_Stocks_DB::clear_cache();

            error_log('[Sempa] Suppliers table created successfully');
            return true;
        }

        /**
         * Add supplier column to products table if it doesn't exist
         */
        private static function ensure_products_supplier_column()
        {
            $db = Sempa_Stocks_DB::instance();

            if (!($db instanceof \wpdb) || empty($db->dbh)) {
                return false;
            }

            $products_table = Sempa_Stocks_DB::table('stocks_sempa');
            if (empty($products_table)) {
                return false;
            }

            // Check if supplier column already exists
            $columns = $db->get_results("SHOW COLUMNS FROM " . Sempa_Stocks_DB::escape_identifier($products_table) . " LIKE 'supplier'");

            if (!empty($columns)) {
                return true; // Column already exists
            }

            // Add supplier column
            $sql = "ALTER TABLE " . Sempa_Stocks_DB::escape_identifier($products_table) . "
                    ADD COLUMN `supplier` varchar(255) DEFAULT NULL COMMENT 'Nom du fournisseur' AFTER `category`";

            $result = $db->query($sql);

            if ($result === false) {
                error_log('[Sempa] Failed to add supplier column to products table: ' . $db->last_error);
                return false;
            }

            // Add index on supplier column
            $sql_index = "ALTER TABLE " . Sempa_Stocks_DB::escape_identifier($products_table) . "
                         ADD INDEX `idx_supplier` (`supplier`)";

            $db->query($sql_index); // Index creation can fail if it already exists, don't check result

            error_log('[Sempa] Supplier column added to products table successfully');
            return true;
        }

        /**
         * Add etat_materiel column to products table if it doesn't exist
         * This column stores the material state: 'neuf' (new) or 'reconditionné' (refurbished)
         */
        private static function ensure_products_etat_materiel_column()
        {
            $db = Sempa_Stocks_DB::instance();

            if (!($db instanceof \wpdb) || empty($db->dbh)) {
                return false;
            }

            $products_table = Sempa_Stocks_DB::table('stocks_sempa');
            if (empty($products_table)) {
                return false;
            }

            // Check if etat_materiel column already exists
            $columns = $db->get_results("SHOW COLUMNS FROM " . Sempa_Stocks_DB::escape_identifier($products_table) . " LIKE 'etat_materiel'");

            if (!empty($columns)) {
                return true; // Column already exists
            }

            // Add etat_materiel column with ENUM type
            $sql = "ALTER TABLE " . Sempa_Stocks_DB::escape_identifier($products_table) . "
                    ADD COLUMN `etat_materiel` ENUM('neuf', 'reconditionné') DEFAULT 'neuf' COMMENT 'État du matériel (neuf ou reconditionné)' AFTER `supplier`";

            $result = $db->query($sql);

            if ($result === false) {
                error_log('[Sempa] Failed to add etat_materiel column to products table: ' . $db->last_error);
                return false;
            }

            error_log('[Sempa] Etat_materiel column added to products table successfully');
            return true;
        }

        /**
         * Add audit trail columns to products and movements tables
         * Adds: created_by, created_at, modified_by, modified_at
         */
        private static function ensure_audit_trail_columns()
        {
            $db = Sempa_Stocks_DB::instance();

            if (!($db instanceof \wpdb) || empty($db->dbh)) {
                return false;
            }

            $products_table = Sempa_Stocks_DB::table('stocks_sempa');
            $movements_table = Sempa_Stocks_DB::table('mouvements_sempa');

            // Add audit columns to products table
            if (!empty($products_table)) {
                self::add_audit_columns_to_table($products_table, 'products');
            }

            // Add audit columns to movements table
            if (!empty($movements_table)) {
                self::add_audit_columns_to_table($movements_table, 'movements');
            }

            return true;
        }

        /**
         * Add audit columns to a specific table
         */
        private static function add_audit_columns_to_table($table_name, $table_type)
        {
            $db = Sempa_Stocks_DB::instance();

            // Check which columns are missing
            $existing_columns = $db->get_col("SHOW COLUMNS FROM " . Sempa_Stocks_DB::escape_identifier($table_name));
            $columns_to_add = [];

            if (!in_array('created_by', $existing_columns)) {
                $columns_to_add[] = "ADD COLUMN `created_by` int(11) DEFAULT NULL COMMENT 'ID utilisateur créateur'";
            }

            if (!in_array('created_at', $existing_columns)) {
                $columns_to_add[] = "ADD COLUMN `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création'";
            }

            if (!in_array('modified_by', $existing_columns)) {
                $columns_to_add[] = "ADD COLUMN `modified_by` int(11) DEFAULT NULL COMMENT 'ID utilisateur dernière modification'";
            }

            if (!in_array('modified_at', $existing_columns)) {
                $columns_to_add[] = "ADD COLUMN `modified_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'Date dernière modification'";
            }

            // If no columns to add, return
            if (empty($columns_to_add)) {
                return true;
            }

            // Build and execute ALTER TABLE query
            $sql = "ALTER TABLE " . Sempa_Stocks_DB::escape_identifier($table_name) . " " . implode(', ', $columns_to_add);

            $result = $db->query($sql);

            if ($result === false) {
                error_log('[Sempa] Failed to add audit trail columns to ' . $table_type . ' table: ' . $db->last_error);
                return false;
            }

            error_log('[Sempa] Audit trail columns added to ' . $table_type . ' table successfully');
            return true;
        }
    }
}
