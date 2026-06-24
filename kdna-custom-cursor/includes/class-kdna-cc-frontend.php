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
		$settings = KDNA_CC_Data::get_settings();

		// Honour hide in admin by not running inside an editor or customizer
		// preview. The WordPress dashboard never enqueues front-end scripts, so
		// this covers the remaining editing contexts shown on the front end.
		if ( ! empty( $settings['options']['hideInAdmin'] ) && $this->is_editor_context() ) {
			return null;
		}

		$global_id = isset( $settings['globalCursorId'] ) ? $settings['globalCursorId'] : null;
		$rules_in  = ( isset( $settings['rules'] ) && is_array( $settings['rules'] ) ) ? $settings['rules'] : array();

		// Collect only the cursors needed to run on this page, keyed by id.
		$needed      = array();
		$clean_rules = array();

		// Keep the rules whose cursor still exists, preserving their order so
		// first match wins on the front end.
		foreach ( $rules_in as $rule ) {
			if ( empty( $rule['selector'] ) || empty( $rule['cursorId'] ) ) {
				continue;
			}
			$cursor = KDNA_CC_Data::get_cursor( $rule['cursorId'] );
			if ( null === $cursor ) {
				// The mapped cursor has been deleted, so drop this rule.
				continue;
			}
			$needed[ $rule['cursorId'] ] = $cursor;
			$clean_rules[]               = array(
				'selector' => $rule['selector'],
				'cursorId' => $rule['cursorId'],
			);
		}

		// The optional global cursor, if it still exists.
		if ( ! empty( $global_id ) ) {
			$global = KDNA_CC_Data::get_cursor( $global_id );
			if ( null !== $global ) {
				$needed[ $global_id ] = $global;
			} else {
				$global_id = null;
			}
		}

		// Nothing to run on this page.
		if ( empty( $global_id ) && empty( $clean_rules ) ) {
			return null;
		}

		return array(
			'globalCursorId' => ! empty( $global_id ) ? $global_id : null,
			'cursors'        => $needed,
			'rules'          => $clean_rules,
			'options'        => $settings['options'],
		);
	}

	/**
	 * Whether the current request is an editor or customizer preview shown on
	 * the front end.
	 *
	 * @return bool True in an editing context.
	 */
	private function is_editor_context() {
		if ( function_exists( 'is_customize_preview' ) && is_customize_preview() ) {
			return true;
		}

		// The Elementor editor loads the page on the front end with this query
		// argument. A plain existence check is enough, no value is read.
		if ( isset( $_GET['elementor-preview'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return true;
		}

		return false;
	}
}
