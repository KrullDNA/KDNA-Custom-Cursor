<?php
/**
 * Admin side of KDNA Custom Cursor.
 *
 * Registers the Settings > KDNA Custom Cursor page, enqueues the admin assets
 * only on that page, and provides the two admin-ajax handlers that save and
 * load the plugin data. Every handler checks a nonce and the manage_options
 * capability before it does anything.
 *
 * @package KDNA_Custom_Cursor
 */

// Stop anyone loading this file directly outside of WordPress.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles the settings page and the AJAX save and load round trip.
 */
class KDNA_CC_Admin {

	/**
	 * The settings page slug under Settings.
	 *
	 * @var string
	 */
	const MENU_SLUG = 'kdna-custom-cursor';

	/**
	 * The nonce action shared by the save and load requests.
	 *
	 * @var string
	 */
	const NONCE_ACTION = 'kdna_cc_ajax';

	/**
	 * The hook suffix WordPress gives us for the settings page.
	 *
	 * Used so we only enqueue our assets on that exact screen.
	 *
	 * @var string
	 */
	private $page_hook = '';

	/**
	 * Wire up the admin hooks.
	 */
	public function __construct() {
		// Register the settings page under the Settings menu.
		add_action( 'admin_menu', array( $this, 'register_menu' ) );

		// Enqueue admin CSS and JS, but only on our own page.
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );

		// The two logged in AJAX actions for saving and loading.
		add_action( 'wp_ajax_kdna_cc_save', array( $this, 'ajax_save' ) );
		add_action( 'wp_ajax_kdna_cc_load', array( $this, 'ajax_load' ) );

		// Add a handy Settings link on the Plugins screen.
		add_filter( 'plugin_action_links_' . KDNA_CC_BASENAME, array( $this, 'add_settings_link' ) );
	}

	/**
	 * Register the settings page under Settings.
	 *
	 * @return void
	 */
	public function register_menu() {
		$this->page_hook = add_options_page(
			__( 'KDNA Custom Cursor', 'kdna-custom-cursor' ),
			__( 'KDNA Custom Cursor', 'kdna-custom-cursor' ),
			'manage_options',
			self::MENU_SLUG,
			array( $this, 'render_page' )
		);
	}

	/**
	 * Add a Settings link next to the plugin on the Plugins screen.
	 *
	 * @param array $links The existing action links.
	 * @return array The action links with our settings link added.
	 */
	public function add_settings_link( $links ) {
		$url  = admin_url( 'options-general.php?page=' . self::MENU_SLUG );
		$link = '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'kdna-custom-cursor' ) . '</a>';

		// Put our link at the front of the list.
		array_unshift( $links, $link );

		return $links;
	}

	/**
	 * Render the settings page by including the markup template.
	 *
	 * @return void
	 */
	public function render_page() {
		// Belt and braces capability check before drawing anything.
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		require KDNA_CC_DIR . 'admin/admin-page.php';
	}

	/**
	 * Enqueue the admin styles and scripts, only on our settings page.
	 *
	 * @param string $hook The current admin page hook suffix.
	 * @return void
	 */
	public function enqueue_assets( $hook ) {
		// Bail on every admin screen except our own settings page.
		if ( $hook !== $this->page_hook ) {
			return;
		}

		// The media library, used by the Image cursor picker.
		wp_enqueue_media();

		// Alpine.js, vendored locally and deferred so the DOM is ready first.
		wp_enqueue_script(
			'kdna-cc-alpine',
			KDNA_CC_URL . 'admin/js/vendor/alpine.min.js',
			array(),
			'3.14.8',
			array(
				'in_footer' => true,
				'strategy'  => 'defer',
			)
		);

		// The shared cursor engine, also used by the front end, so the live
		// preview matches front-end output exactly.
		wp_enqueue_script(
			'kdna-cc-engine',
			KDNA_CC_URL . 'assets/js/kdna-cc-engine.js',
			array(),
			KDNA_CC_VERSION,
			array( 'in_footer' => true )
		);

		// The front-end cursor layer styles, loaded here too so the preview
		// uses the same base styles as the front end.
		wp_enqueue_style(
			'kdna-cc-cursor',
			KDNA_CC_URL . 'assets/css/kdna-cc-cursor.css',
			array(),
			KDNA_CC_VERSION
		);

		// Our admin stylesheet.
		wp_enqueue_style(
			'kdna-cc-admin',
			KDNA_CC_URL . 'admin/css/kdna-cc-admin.css',
			array( 'kdna-cc-cursor' ),
			KDNA_CC_VERSION
		);

		// Our admin script. It registers the Alpine component before Alpine
		// boots, and depends on the engine being loaded first.
		wp_enqueue_script(
			'kdna-cc-admin',
			KDNA_CC_URL . 'admin/js/kdna-cc-admin.js',
			array( 'kdna-cc-engine' ),
			KDNA_CC_VERSION,
			array( 'in_footer' => true )
		);

		// Hand the script the AJAX url, a fresh nonce and the action names.
		wp_localize_script(
			'kdna-cc-admin',
			'kdnaCcData',
			array(
				'ajaxUrl'    => admin_url( 'admin-ajax.php' ),
				'nonce'      => wp_create_nonce( self::NONCE_ACTION ),
				'saveAction' => 'kdna_cc_save',
				'loadAction' => 'kdna_cc_load',
				'presets'    => KDNA_CC_Presets::get_presets(),
			)
		);
	}

	/* --------------------------------------------------------------------- */
	/* AJAX                                                                  */
	/* --------------------------------------------------------------------- */

	/**
	 * Check the nonce and capability shared by both AJAX handlers.
	 *
	 * Sends a JSON error and stops the request if either check fails.
	 *
	 * @return void
	 */
	private function verify_request() {
		// Verify the nonce sent in the nonce field. Stops on failure.
		check_ajax_referer( self::NONCE_ACTION, 'nonce' );

		// Only administrators may read or write cursor data.
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array( 'message' => __( 'You do not have permission to do this.', 'kdna-custom-cursor' ) ),
				403
			);
		}
	}

	/**
	 * AJAX handler: save cursors and settings.
	 *
	 * Expects optional cursors and settings fields, each a JSON string. Each is
	 * decoded, sanitised through the data layer and stored. The cleaned data is
	 * sent back so the admin can sync to exactly what was saved.
	 *
	 * @return void
	 */
	public function ajax_save() {
		$this->verify_request();

		$response = array();

		// Save the cursor library if it was sent.
		if ( isset( $_POST['cursors'] ) ) {
			$cursors_raw = json_decode( wp_unslash( $_POST['cursors'] ), true ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.ValidatedSanitizedInput.MissingUnslash -- Decoded then fully sanitised in the data layer.
			if ( ! is_array( $cursors_raw ) ) {
				$cursors_raw = array();
			}
			$response['cursors'] = KDNA_CC_Data::save_cursors( $cursors_raw );
		}

		// Save the settings if they were sent.
		if ( isset( $_POST['settings'] ) ) {
			$settings_raw = json_decode( wp_unslash( $_POST['settings'] ), true ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.ValidatedSanitizedInput.MissingUnslash -- Decoded then fully sanitised in the data layer.
			if ( ! is_array( $settings_raw ) ) {
				$settings_raw = array();
			}
			$response['settings'] = KDNA_CC_Data::save_settings( $settings_raw );
		}

		wp_send_json_success( $response );
	}

	/**
	 * AJAX handler: load the current cursors and settings.
	 *
	 * @return void
	 */
	public function ajax_load() {
		$this->verify_request();

		wp_send_json_success(
			array(
				'cursors'  => KDNA_CC_Data::get_cursors(),
				'settings' => KDNA_CC_Data::get_settings(),
			)
		);
	}
}
