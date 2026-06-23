<?php
/**
 * Core bootstrap for KDNA Custom Cursor.
 *
 * A small singleton that loads the right pieces and wires them up. The admin is
 * only loaded in the dashboard. The conditional front-end engine and the
 * optional Elementor control are loaded in later stages.
 *
 * @package KDNA_Custom_Cursor
 */

// Stop anyone loading this file directly outside of WordPress.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Loads dependencies and starts the admin.
 */
class KDNA_CC_Core {

	/**
	 * The single shared instance of this class.
	 *
	 * @var KDNA_CC_Core|null
	 */
	private static $instance = null;

	/**
	 * The admin handler, created only inside the dashboard.
	 *
	 * @var KDNA_CC_Admin|null
	 */
	public $admin = null;

	/**
	 * Get the single shared instance, creating it on first use.
	 *
	 * @return KDNA_CC_Core The shared instance.
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Set things up. Private so the singleton is the only way in.
	 */
	private function __construct() {
		$this->load_dependencies();
		$this->init();
	}

	/**
	 * Load the class files this plugin needs.
	 *
	 * The data layer is already loaded by the main file. The admin is only
	 * needed inside the dashboard. The front-end engine (Stage 3) and the
	 * Elementor control (Stage 7) are added in their own stages.
	 *
	 * @return void
	 */
	private function load_dependencies() {
		if ( is_admin() ) {
			require_once KDNA_CC_DIR . 'includes/class-kdna-cc-admin.php';
		}
	}

	/**
	 * Create the parts of the plugin that should run for this request.
	 *
	 * @return void
	 */
	private function init() {
		if ( is_admin() ) {
			$this->admin = new KDNA_CC_Admin();
		}
	}
}
