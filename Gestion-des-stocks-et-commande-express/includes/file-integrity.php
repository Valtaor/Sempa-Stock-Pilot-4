<?php
/**
 * Système de vérification d'intégrité des fichiers critiques
 *
 * Ce système calcule et vérifie les checksums MD5 des fichiers critiques
 * pour détecter toute corruption ou modification non autorisée.
 *
 * @package SEMPA
 * @since 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe de gestion de l'intégrité des fichiers
 */
final class Sempa_File_Integrity
{
    /**
     * Liste des fichiers critiques à surveiller
     *
     * @var array
     */
    private const CRITICAL_FILES = [
        'functions.php',
        'includes/functions_stocks.php',
        'includes/db_connect_stocks.php',
        'includes/functions_commandes.php',
        'includes/db_commandes.php',
        'includes/file-integrity.php',
    ];

    /**
     * Option WordPress pour stocker les checksums
     *
     * @var string
     */
    private const CHECKSUM_OPTION = 'sempa_file_checksums';

    /**
     * Option WordPress pour stocker la dernière vérification
     *
     * @var string
     */
    private const LAST_CHECK_OPTION = 'sempa_last_integrity_check';

    /**
     * Email de notification en cas de corruption
     *
     * @var string
     */
    private const ALERT_EMAIL = 'admin@sempa.fr';

    /**
     * Enregistre les hooks WordPress nécessaires
     */
    public static function register()
    {
        // Vérifier l'intégrité toutes les heures
        add_action('sempa_hourly_integrity_check', [__CLASS__, 'verify_integrity']);

        // Enregistrer le cron job s'il n'existe pas
        if (!wp_next_scheduled('sempa_hourly_integrity_check')) {
            wp_schedule_event(time(), 'hourly', 'sempa_hourly_integrity_check');
        }

        // Hook d'activation pour initialiser les checksums
        add_action('init', [__CLASS__, 'maybe_initialize_checksums'], 5);
    }

    /**
     * Initialise les checksums si c'est la première fois
     */
    public static function maybe_initialize_checksums()
    {
        $checksums = get_option(self::CHECKSUM_OPTION, []);

        // Si les checksums n'existent pas, les créer
        if (empty($checksums)) {
            self::update_checksums();
            error_log('[SEMPA Integrity] Checksums initialisés pour ' . count(self::CRITICAL_FILES) . ' fichiers');
        }
    }

    /**
     * Calcule et stocke les checksums de tous les fichiers critiques
     *
     * @return bool True si les checksums ont été mis à jour
     */
    public static function update_checksums()
    {
        $base_dir = get_stylesheet_directory();
        $checksums = [];

        foreach (self::CRITICAL_FILES as $file) {
            $file_path = $base_dir . '/' . $file;

            if (file_exists($file_path)) {
                $checksums[$file] = [
                    'md5' => md5_file($file_path),
                    'size' => filesize($file_path),
                    'mtime' => filemtime($file_path),
                    'last_check' => current_time('mysql'),
                ];
            } else {
                error_log('[SEMPA Integrity] ATTENTION : Fichier critique manquant : ' . $file);
            }
        }

        update_option(self::CHECKSUM_OPTION, $checksums, false);
        update_option(self::LAST_CHECK_OPTION, current_time('mysql'), false);

        return true;
    }

    /**
     * Vérifie l'intégrité de tous les fichiers critiques
     *
     * @return array Résultats de la vérification
     */
    public static function verify_integrity()
    {
        $base_dir = get_stylesheet_directory();
        $stored_checksums = get_option(self::CHECKSUM_OPTION, []);
        $results = [
            'status' => 'ok',
            'corrupted' => [],
            'missing' => [],
            'modified' => [],
            'checked_at' => current_time('mysql'),
        ];

        if (empty($stored_checksums)) {
            // Pas de checksums de référence, les initialiser
            self::update_checksums();
            $results['status'] = 'initialized';
            return $results;
        }

        foreach (self::CRITICAL_FILES as $file) {
            $file_path = $base_dir . '/' . $file;

            // Vérifier si le fichier existe
            if (!file_exists($file_path)) {
                $results['missing'][] = $file;
                $results['status'] = 'error';
                error_log('[SEMPA Integrity] ERREUR : Fichier critique manquant : ' . $file);
                continue;
            }

            // Calculer le checksum actuel
            $current_md5 = md5_file($file_path);
            $current_size = filesize($file_path);

            // Vérifier si le fichier a un checksum de référence
            if (!isset($stored_checksums[$file])) {
                error_log('[SEMPA Integrity] ATTENTION : Pas de checksum de référence pour : ' . $file);
                continue;
            }

            $stored_checksum = $stored_checksums[$file];

            // Comparer les checksums
            if ($current_md5 !== $stored_checksum['md5']) {
                $results['corrupted'][] = [
                    'file' => $file,
                    'expected_md5' => $stored_checksum['md5'],
                    'actual_md5' => $current_md5,
                    'expected_size' => $stored_checksum['size'],
                    'actual_size' => $current_size,
                ];
                $results['status'] = 'error';
                error_log('[SEMPA Integrity] ERREUR : Fichier corrompu détecté : ' . $file);
            }

            // Vérifier si le fichier a été modifié récemment
            $current_mtime = filemtime($file_path);
            if ($current_mtime !== $stored_checksum['mtime']) {
                $results['modified'][] = [
                    'file' => $file,
                    'last_modified' => date('Y-m-d H:i:s', $current_mtime),
                ];
            }
        }

        // Mettre à jour la date de dernière vérification
        update_option(self::LAST_CHECK_OPTION, current_time('mysql'), false);

        // Envoyer une alerte si des problèmes sont détectés
        if ($results['status'] === 'error') {
            self::send_alert_email($results);
        }

        return $results;
    }

    /**
     * Envoie un email d'alerte en cas de corruption détectée
     *
     * @param array $results Résultats de la vérification
     * @return bool True si l'email a été envoyé
     */
    private static function send_alert_email($results)
    {
        $subject = '[SEMPA CRITIQUE] Corruption de fichiers détectée';

        $message = "Une corruption de fichiers critiques a été détectée sur le site SEMPA.\n\n";
        $message .= "Date de détection : " . current_time('mysql') . "\n";
        $message .= "URL du site : " . home_url() . "\n\n";

        if (!empty($results['missing'])) {
            $message .= "=== FICHIERS MANQUANTS ===\n";
            foreach ($results['missing'] as $file) {
                $message .= "- " . $file . "\n";
            }
            $message .= "\n";
        }

        if (!empty($results['corrupted'])) {
            $message .= "=== FICHIERS CORROMPUS ===\n";
            foreach ($results['corrupted'] as $corruption) {
                $message .= "Fichier : " . $corruption['file'] . "\n";
                $message .= "  MD5 attendu : " . $corruption['expected_md5'] . "\n";
                $message .= "  MD5 actuel  : " . $corruption['actual_md5'] . "\n";
                $message .= "  Taille attendue : " . $corruption['expected_size'] . " octets\n";
                $message .= "  Taille actuelle : " . $corruption['actual_size'] . " octets\n\n";
            }
        }

        $message .= "\n=== ACTIONS RECOMMANDÉES ===\n";
        $message .= "1. Restaurer les fichiers depuis un backup récent\n";
        $message .= "2. Vérifier les logs du serveur pour détecter une intrusion\n";
        $message .= "3. Scanner le serveur pour détecter des malwares\n";
        $message .= "4. Mettre à jour les checksums après restauration avec : Sempa_File_Integrity::update_checksums()\n";

        $headers = ['Content-Type: text/plain; charset=UTF-8'];

        $sent = wp_mail(self::ALERT_EMAIL, $subject, $message, $headers);

        if ($sent) {
            error_log('[SEMPA Integrity] Email d\'alerte envoyé à ' . self::ALERT_EMAIL);
        } else {
            error_log('[SEMPA Integrity] ERREUR : Impossible d\'envoyer l\'email d\'alerte');
        }

        return $sent;
    }

    /**
     * Obtient le statut actuel de l'intégrité
     *
     * @return array Statut et informations
     */
    public static function get_status()
    {
        $checksums = get_option(self::CHECKSUM_OPTION, []);
        $last_check = get_option(self::LAST_CHECK_OPTION, '');
        $next_check = wp_next_scheduled('sempa_hourly_integrity_check');

        return [
            'files_monitored' => count($checksums),
            'last_check' => $last_check,
            'next_check' => $next_check ? date('Y-m-d H:i:s', $next_check) : 'Non planifié',
            'status' => !empty($checksums) ? 'active' : 'not_initialized',
        ];
    }

    /**
     * Désactive la surveillance (à utiliser lors de la désactivation du plugin)
     */
    public static function deactivate()
    {
        $timestamp = wp_next_scheduled('sempa_hourly_integrity_check');
        if ($timestamp) {
            wp_unschedule_event($timestamp, 'sempa_hourly_integrity_check');
        }

        error_log('[SEMPA Integrity] Surveillance d\'intégrité désactivée');
    }

    /**
     * Affiche un rapport d'intégrité (pour debug)
     *
     * @return string Rapport au format texte
     */
    public static function get_report()
    {
        $results = self::verify_integrity();
        $status = self::get_status();

        $report = "=== RAPPORT D'INTÉGRITÉ SEMPA ===\n\n";
        $report .= "Fichiers surveillés : " . $status['files_monitored'] . "\n";
        $report .= "Dernière vérification : " . $status['last_check'] . "\n";
        $report .= "Prochaine vérification : " . $status['next_check'] . "\n";
        $report .= "Statut : " . strtoupper($results['status']) . "\n\n";

        if ($results['status'] === 'ok') {
            $report .= "✓ Tous les fichiers sont intacts\n";
        } else {
            if (!empty($results['missing'])) {
                $report .= "✗ Fichiers manquants : " . count($results['missing']) . "\n";
            }
            if (!empty($results['corrupted'])) {
                $report .= "✗ Fichiers corrompus : " . count($results['corrupted']) . "\n";
            }
        }

        return $report;
    }
}

// Enregistrer les hooks si WordPress est chargé
if (function_exists('add_action')) {
    Sempa_File_Integrity::register();
}
