/**
 * Formulaires du site → base Heart's Angels.
 * Collez TOUT ce fichier à la fin de functions.php (Apparence → Éditeur de fichiers des thèmes).
 * N'activez pas en plus l'extension « Heart's Angels — Demandes de souhait » : le code serait en double.
 */
/**
 * Plugin Name: Heart's Angels — Demandes de souhait
 * Description: Quand les formulaires Contact Form 7 « Demande de souhait » et « Devenir bénévole » sont envoyés, ils sont aussi enregistrés dans la base de l'application (en plus de l'e-mail).
 * Version: 1.1.0
 * Author: Heart's Angels ASBL
 * Requires Plugins: contact-form-7
 */

if (!defined('ABSPATH')) {
    exit;
}

const HA_DEMANDES_OPTION = 'ha_demandes_settings';

function ha_demandes_defaults() {
    return array(
        'supabase_url' => 'https://vppmvjqbzdeftrhdoert.supabase.co',
        'supabase_key' => 'sb_publishable_A_Bu4P4-Fn-sy3xF58U4Cg_kJ_aLSIH',
        'form_title'   => 'Demande de souhait',
        'form_id'      => 0,
    );
}

function ha_demandes_settings() {
    $saved = get_option(HA_DEMANDES_OPTION, array());
    if (!is_array($saved)) {
        $saved = array();
    }
    return wp_parse_args($saved, ha_demandes_defaults());
}

function ha_demandes_sanitize($input) {
    $input = is_array($input) ? $input : array();
    return array(
        'supabase_url' => esc_url_raw(isset($input['supabase_url']) ? $input['supabase_url'] : ''),
        'supabase_key' => sanitize_text_field(isset($input['supabase_key']) ? $input['supabase_key'] : ''),
        'form_title'   => sanitize_text_field(isset($input['form_title']) ? $input['form_title'] : ''),
        'form_id'      => absint(isset($input['form_id']) ? $input['form_id'] : 0),
    );
}

add_action('admin_init', function () {
    register_setting('ha_demandes', HA_DEMANDES_OPTION, array(
        'type'              => 'array',
        'sanitize_callback' => 'ha_demandes_sanitize',
        'default'           => ha_demandes_defaults(),
    ));
});

add_action('admin_menu', function () {
    add_options_page(
        'Demandes de souhait',
        'Demandes de souhait',
        'manage_options',
        'ha-demandes',
        'ha_demandes_page'
    );
});

add_action('admin_notices', function () {
    if (!current_user_can('manage_options')) {
        return;
    }
    if (!defined('WPCF7_VERSION')) {
        echo '<div class="notice notice-error"><p>Heart\'s Angels : le plugin Contact Form 7 doit rester actif pour enregistrer les demandes de souhait.</p></div>';
        return;
    }
    $err = get_option('ha_demandes_last_error');
    if ($err) {
        echo '<div class="notice notice-error"><p>Heart\'s Angels — le dernier formulaire n\'a pas pu être enregistré dans la base : '
            . esc_html($err)
            . ' L\'e-mail, lui, est bien parti. <a href="' . esc_url(admin_url('options-general.php?page=ha-demandes')) . '">Vérifier le réglage</a>.</p></div>';
    }
});

add_action('wpcf7_mail_sent', 'ha_demandes_on_sent');

function ha_demandes_on_sent($form) {
    if (!class_exists('WPCF7_Submission')) {
        return;
    }
    $submission = WPCF7_Submission::get_instance();
    if (!$submission) {
        return;
    }
    $posted = $submission->get_posted_data();
    $kind = ha_demandes_kind($form, $posted);
    if ($kind === '') {
        return;
    }

    $settings = ha_demandes_settings();
    if ($settings['supabase_url'] === '' || $settings['supabase_key'] === '') {
        update_option('ha_demandes_last_error', 'Adresse ou clé Supabase manquante.', false);
        return;
    }

    if ($kind === 'benevole') {
        $table = 'candidatures_benevoles';
        $row = ha_benevoles_map($posted);
    } else {
        $table = 'demandes_souhaits';
        $row = ha_demandes_map($posted);
    }
    $code = ha_demandes_insert($settings, $table, $row);
    if (is_wp_error($code)) {
        update_option('ha_demandes_last_error', $code->get_error_message(), false);
        return;
    }
    delete_option('ha_demandes_last_error');
}

function ha_demandes_kind($form, $posted) {
    $id = method_exists($form, 'id') ? (int) $form->id() : 0;
    $title = method_exists($form, 'title') ? trim($form->title()) : '';
    $title_l = function_exists('mb_strtolower') ? mb_strtolower($title, 'UTF-8') : strtolower($title);
    if (
        $id === 323
        || $title_l === 'devenir bénévole'
        || $title_l === 'devenir benevole'
        || (isset($posted['your-name'], $posted['your-prenom']) && (isset($posted['motivation']) || isset($posted['comite'])))
    ) {
        return 'benevole';
    }
    if (ha_demandes_is_form($form, $posted)) {
        return 'souhait';
    }
    return '';
}

function ha_demandes_is_form($form, $posted) {
    $settings = ha_demandes_settings();
    $id = (method_exists($form, 'id') ? (int) $form->id() : 0);
    if ((int) $settings['form_id'] > 0) {
        return $id === (int) $settings['form_id'];
    }
    $title = method_exists($form, 'title') ? trim($form->title()) : '';
    if ($settings['form_title'] !== '' && $title === trim($settings['form_title'])) {
        return true;
    }
    return isset($posted['text-138'], $posted['email-174'], $posted['textarea-546']);
}

function ha_demandes_field($posted, $key) {
    if (!isset($posted[$key])) {
        return '';
    }
    $value = $posted[$key];
    if (is_array($value)) {
        $value = implode(', ', array_filter(array_map('strval', $value)));
    }
    return trim(wp_strip_all_tags((string) $value));
}

function ha_demandes_split_nom($full) {
    $full = trim(preg_replace('/\s+/u', ' ', (string) $full));
    if ($full === '') {
        return array('', '');
    }
    if (strpos($full, ',') !== false) {
        $bits = array_map('trim', explode(',', $full, 2));
        if ($bits[0] !== '' && $bits[1] !== '') {
            return array($bits[1], $bits[0]);
        }
    }
    $parts = explode(' ', $full);
    if (count($parts) === 1) {
        return array($parts[0], $parts[0]);
    }
    $nom = array_pop($parts);
    return array(implode(' ', $parts), $nom);
}

function ha_demandes_date($value) {
    $value = trim((string) $value);
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m)) {
        return checkdate((int) $m[2], (int) $m[3], (int) $m[1]) ? $value : null;
    }
    if (preg_match('/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/', $value, $m)) {
        if (!checkdate((int) $m[2], (int) $m[1], (int) $m[3])) {
            return null;
        }
        return sprintf('%04d-%02d-%02d', (int) $m[3], (int) $m[2], (int) $m[1]);
    }
    return null;
}

function ha_demandes_adresse($rue, $cp_localite) {
    $rue = trim((string) $rue);
    $cp_localite = trim((string) $cp_localite);
    if ($rue === '' && $cp_localite === '') {
        return null;
    }
    $cp = '';
    $localite = $cp_localite;
    if (preg_match('/^(\d{4})\s+(.+)$/u', $cp_localite, $m)) {
        $cp = $m[1];
        $localite = trim($m[2]);
    }
    return array(
        'rue'      => $rue,
        'cp'       => $cp,
        'localite' => $localite,
        'pays'     => 'Belgique',
    );
}

function ha_demandes_map($posted) {
    list($patient_prenom, $patient_nom) = ha_demandes_split_nom(ha_demandes_field($posted, 'text-138'));
    list($contact_prenom, $contact_nom) = ha_demandes_split_nom(ha_demandes_field($posted, 'text-160'));
    list($autre_prenom, $autre_nom) = ha_demandes_split_nom(ha_demandes_field($posted, 'text-691'));

    if ($contact_prenom === '') {
        $contact_prenom = $autre_prenom !== '' ? $autre_prenom : $patient_prenom;
        $contact_nom = $autre_nom !== '' ? $autre_nom : $patient_nom;
    }
    if ($patient_prenom === '') {
        $patient_prenom = $contact_prenom !== '' ? $contact_prenom : 'Non précisé';
        $patient_nom = $contact_nom !== '' ? $contact_nom : 'Non précisé';
    }
    if ($contact_prenom === '') {
        $contact_prenom = $patient_prenom;
        $contact_nom = $patient_nom;
    }

    $email = ha_demandes_field($posted, 'email-174');
    if ($email === '') {
        $email = ha_demandes_field($posted, 'email-926');
    }
    if ($email === '') {
        $email = ha_demandes_field($posted, 'email-819');
    }
    if ($email === '') {
        $email = 'inconnu@heartsangels.be';
    }

    $sejour_type = ha_demandes_field($posted, 'radio-650');
    $sejour_adresse = ha_demandes_adresse(
        ha_demandes_field($posted, 'text-807'),
        ha_demandes_field($posted, 'text-30')
    );
    $patient_adresse = ha_demandes_adresse(
        ha_demandes_field($posted, 'text-246'),
        ha_demandes_field($posted, 'text-126')
    );
    if ($patient_adresse === null && $sejour_type === 'Domicile') {
        $patient_adresse = $sejour_adresse;
    }

    $description = ha_demandes_field($posted, 'textarea-546');
    $medical = ha_demandes_field($posted, 'textarea-56');
    if ($description === '') {
        $description = $medical !== '' ? $medical : 'Demande reçue via le site (dossier à compléter).';
    }

    $lieu = '';
    if (is_array($sejour_adresse)) {
        $lieu = trim($sejour_adresse['rue'] . ($sejour_adresse['cp'] !== '' || $sejour_adresse['localite'] !== ''
            ? ', ' . trim($sejour_adresse['cp'] . ' ' . $sejour_adresse['localite'])
            : ''));
    }

    $medecin = ha_demandes_field($posted, 'text-706');
    $fichier = ha_demandes_field($posted, 'file-704');

    $complements = array(
        'origine' => 'wordpress',
        'beneficiaire' => array(
            'email'     => ha_demandes_field($posted, 'email-819'),
            'telephone' => ha_demandes_field($posted, 'tel-386'),
            'registre'  => ha_demandes_field($posted, 'registre'),
        ),
        'contact_secondaire' => array(
            'nom'       => trim($autre_prenom . ' ' . $autre_nom),
            'email'     => ha_demandes_field($posted, 'email-926'),
            'telephone' => ha_demandes_field($posted, 'tel-397'),
        ),
        'sejour' => array(
            'type'      => $sejour_type,
            'adresse'   => $sejour_adresse,
            'telephone' => ha_demandes_field($posted, 'tel-19'),
        ),
        'medecin' => array(
            'nom'       => $medecin,
            'telephone' => ha_demandes_field($posted, 'tel-401'),
            'email'     => ha_demandes_field($posted, 'email-817'),
        ),
        'situation_medicale' => $medical,
        'fichier' => $fichier,
    );
    $complements = ha_demandes_prune($complements);
    if ($complements === array()) {
        $complements = null;
    }

    return array(
        'patient_prenom'      => $patient_prenom,
        'patient_nom'         => $patient_nom,
        'patient_ddn'         => ha_demandes_date(ha_demandes_field($posted, 'date-naissance')),
        'patient_tel_gsm'     => ha_demandes_field($posted, 'tel-386'),
        'patient_adresse'     => $patient_adresse,
        'etablissement'       => $sejour_type,
        'medecin_referent'    => $medecin,
        'contact_prenom'      => $contact_prenom,
        'contact_nom'         => $contact_nom,
        'contact_email'       => $email,
        'contact_telephone'   => ha_demandes_field($posted, 'tel-22'),
        'souhait_description' => $description,
        'souhait_lieu'        => $lieu,
        'consent_patient'     => true,
        'consent_rgpd'        => true,
        'source'              => 'externe',
        'complements'         => $complements,
    );
}

function ha_demandes_prune($value) {
    if (!is_array($value)) {
        return $value;
    }
    $out = array();
    foreach ($value as $key => $item) {
        $item = ha_demandes_prune($item);
        if ($item === null || $item === '' || $item === array()) {
            continue;
        }
        $out[$key] = $item;
    }
    return $out;
}

function ha_benevoles_map($posted) {
    $prenom = ha_demandes_field($posted, 'your-prenom');
    $nom = ha_demandes_field($posted, 'your-name');
    if ($prenom === '') {
        $prenom = 'Non précisé';
    }
    if ($nom === '') {
        $nom = 'Non précisé';
    }
    $email = ha_demandes_field($posted, 'your-email');
    if ($email === '') {
        $email = 'inconnu@heartsangels.be';
    }

    $comite = array();
    if (isset($posted['comite'])) {
        $comite = $posted['comite'];
    } elseif (isset($posted['comite[]'])) {
        $comite = $posted['comite[]'];
    }
    if (!is_array($comite)) {
        $comite = $comite === '' ? array() : array($comite);
    }
    $comite = array_values(array_filter(array_map(function ($value) {
        return trim(wp_strip_all_tags((string) $value));
    }, $comite)));

    $row = array(
        'prenom'          => $prenom,
        'nom'             => $nom,
        'email'           => $email,
        'telephone'       => ha_demandes_field($posted, 'telephone'),
        'date_naissance'  => ha_demandes_date(ha_demandes_field($posted, 'date-naissance')),
        'adresse'         => ha_demandes_adresse(ha_demandes_field($posted, 'rue'), ha_demandes_field($posted, 'ville')),
        'registre'        => ha_demandes_field($posted, 'registre'),
        'comites'         => $comite,
        'profession'      => ha_demandes_field($posted, 'profession'),
        'motivation'      => ha_demandes_field($posted, 'motivation'),
        'commentaires'    => ha_demandes_field($posted, 'commentaires'),
        'photo_nom'       => ha_demandes_field($posted, 'photo'),
        'diplome_nom'     => ha_demandes_field($posted, 'diplome'),
        'source'          => 'wordpress',
    );
    foreach ($row as $key => $value) {
        if ($value === null || $value === '' || $value === array()) {
            unset($row[$key]);
        }
    }
    $row['prenom'] = $prenom;
    $row['nom'] = $nom;
    $row['email'] = $email;
    $row['source'] = 'wordpress';
    return $row;
}

function ha_demandes_insert($settings, $table, $row) {
    $url = rtrim($settings['supabase_url'], '/') . '/rest/v1/' . rawurlencode($table);
    $response = wp_remote_post($url, array(
        'timeout' => 12,
        'headers' => array(
            'apikey'        => $settings['supabase_key'],
            'Authorization' => 'Bearer ' . $settings['supabase_key'],
            'Content-Type'  => 'application/json',
            'Prefer'        => 'return=minimal',
        ),
        'body' => wp_json_encode($row),
    ));
    if (is_wp_error($response)) {
        return $response;
    }
    $code = (int) wp_remote_retrieve_response_code($response);
    if ($code >= 200 && $code < 300) {
        return true;
    }
    $body = wp_remote_retrieve_body($response);
    return new WP_Error('ha_demandes_http', 'HTTP ' . $code . ' ' . $body);
}

function ha_demandes_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $s = ha_demandes_settings();
    $tested = isset($_GET['ha_test']) ? sanitize_text_field(wp_unslash($_GET['ha_test'])) : '';
    ?>
    <div class="wrap">
        <h1>Formulaires du site</h1>
        <p>Deux formulaires sont enregistrés dans l'application, en plus de leur e-mail. <strong>Demande de souhait</strong> apparaît dans Souhaits → Demandes. <strong>Devenir bénévole</strong> apparaît dans Administration → Membres. La photo et le diplôme restent joints à l'e-mail : la base conserve leur nom.</p>
        <?php if ($tested === 'ok') : ?>
            <div class="notice notice-success"><p>La clé est acceptée par la base.</p></div>
        <?php elseif ($tested === 'ko') : ?>
            <div class="notice notice-error"><p>La connexion a échoué. Vérifiez l'adresse et la clé publique.</p></div>
        <?php endif; ?>
        <form method="post" action="options.php">
            <?php settings_fields('ha_demandes'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="ha-url">Adresse Supabase</label></th>
                    <td><input id="ha-url" name="<?php echo esc_attr(HA_DEMANDES_OPTION); ?>[supabase_url]" type="url" class="regular-text" value="<?php echo esc_attr($s['supabase_url']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="ha-key">Clé publique</label></th>
                    <td>
                        <input id="ha-key" name="<?php echo esc_attr(HA_DEMANDES_OPTION); ?>[supabase_key]" type="text" class="large-text" value="<?php echo esc_attr($s['supabase_key']); ?>" autocomplete="off">
                        <p class="description">La clé publique déjà utilisée par l'application. Ne collez pas la clé secrète.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="ha-title">Titre du formulaire</label></th>
                    <td><input id="ha-title" name="<?php echo esc_attr(HA_DEMANDES_OPTION); ?>[form_title]" type="text" class="regular-text" value="<?php echo esc_attr($s['form_title']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="ha-id">N° du formulaire</label></th>
                    <td>
                        <input id="ha-id" name="<?php echo esc_attr(HA_DEMANDES_OPTION); ?>[form_id]" type="number" min="0" class="small-text" value="<?php echo esc_attr((string) $s['form_id']); ?>">
                        <p class="description">Concerne seulement « Demande de souhait ». 0 = le reconnaître par son titre. « Devenir bénévole » est reconnu à part (formulaire n° 323).</p>
                    </td>
                </tr>
            </table>
            <?php submit_button('Enregistrer'); ?>
        </form>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <?php wp_nonce_field('ha_demandes_test'); ?>
            <input type="hidden" name="action" value="ha_demandes_test">
            <?php submit_button('Tester la connexion', 'secondary'); ?>
        </form>
    </div>
    <?php
}

add_action('admin_post_ha_demandes_test', function () {
    if (!current_user_can('manage_options')) {
        wp_die('Interdit');
    }
    check_admin_referer('ha_demandes_test');
    $s = ha_demandes_settings();
    $url = rtrim($s['supabase_url'], '/') . '/rest/v1/demandes_souhaits?select=id&limit=1';
    $response = wp_remote_get($url, array(
        'timeout' => 12,
        'headers' => array(
            'apikey'        => $s['supabase_key'],
            'Authorization' => 'Bearer ' . $s['supabase_key'],
        ),
    ));
    $ok = false;
    if (!is_wp_error($response)) {
        $code = (int) wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $invalid = stripos($body, 'Invalid API key') !== false || stripos($body, 'No API key') !== false;
        $ok = !$invalid && $code > 0 && $code < 500;
    }
    wp_safe_redirect(add_query_arg('ha_test', $ok ? 'ok' : 'ko', admin_url('options-general.php?page=ha-demandes')));
    exit;
});
