<?php
/**
 * Front-end side of KDNA Custom Cursor.
 *
 * Works out whether a cursor should run on the current page and, if so, enqueues
 * the shared engine and the cursor layer styles, then hands the engine a config
 * resolved from the saved settings. The assets are only enqueued when a cursor
 * is actually configured, so pages with nothing to show stay untouched.
 *
 * Stage 3 runs the optional global cursor. Stage 4 adds the per-class rules.
 *
 * @package KDNA_Custom_Cursor
 */

// Stop anyone loading this file directly outside of WordPress.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Enqueues and configures the front-end cursor engine.
 */
class KDNA_CC_Frontend {

	/**
	 * Wire up the front-end hooks.
	 */
	public function __construct() {
		// Enqueue on the front end, late so other plugins have registered first.
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue' ), 20 );
	}

	/**
	 * Enqueue the engine and styles when a cursor should run on this page.
	 *
	 * @return void
	 */
	public function enqueue() {
		// Build the config for this page. A null result means nothing should
		// run here, so we enqueue nothing at all.
		$config = $this->build_config();
		if ( null === $config ) {
			return;
		}

		// The front-end cursor layer styles.
		wp_enqueue_style(
			'kdna-cc-cursor',
			KDNA_CC_URL . 'assets/css/kdna-cc-cursor.css',
			array(),
			KDNA_CC_VERSION
		);

		// The shared engine, the same file the admin preview uses.
		wp_enqueue_script(
			'kdna-cc-engine',
			KDNA_CC_URL . 'assets/js/kdna-cc-engine.js',
			array(),
			KDNA_CC_VERSION,
			array( 'in_footer' => true )
		);

		// Hand the engine its config (printed before the engine script).
		wp_localize_script( 'kdna-cc-engine', 'kdnaCcFront', $config );

		// Start the engine once it has loaded (printed after the engine script).
		wp_add_inline_script(
			'kdna-cc-engine',
			'window.KdnaCC && window.KdnaCC.startFrontend && window.KdnaCC.startFrontend( window.kdnaCcFront );'
		);
	}

	/**
	 * Build the front-end config from the saved settings and cursor library.
	 *
	 * @return array|null The config, or null when nothing should run here.
	 */
	private function build_config() {
		$settings  = KDNA_CC_Data::get_settings();
		$global_id = isset( $settings['globalCursorId'] ) ? $settings['globalCursorId'] : null;

		// Stage 3 only runs the optional global cursor. With none set, there is
		// nothing to do on this page yet.
		if ( empty( $global_id ) ) {
			return null;
		}

		// The referenced cursor may have been deleted since it was chosen.
		$global = KDNA_CC_Data::get_cursor( $global_id );
		if ( null === $global ) {
			return null;
		}

		// Only ship the cursors that are needed to run on this page.
		$cursors = array(
			$global_id => $global,
		);

		return array(
			'globalCursorId' => $global_id,
			'cursors'        => $cursors,
			'rules'          => array(), // populated in Stage 4.
			'options'        => $settings['options'],
		);
	}
}
