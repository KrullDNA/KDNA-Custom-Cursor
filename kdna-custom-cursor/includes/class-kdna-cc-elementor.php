<?php
/**
 * Optional Elementor integration for KDNA Custom Cursor.
 *
 * Adds a control in the Advanced tab of Elementor sections and widgets so a
 * designer can pick a saved cursor without typing a class name. Implemented in
 * Stage 7. Placeholder for Stage 1 so the file structure in the brief is in
 * place. Not loaded by the core until Stage 7.
 *
 * When implemented, the Elementor hooks are registered at file load time rather
 * than inside elementor/loaded, per the brief.
 *
 * UK English throughout. No em dashes.
 *
 * @package KDNA_Custom_Cursor
 */

// Stop anyone loading this file directly outside of WordPress.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the optional Advanced-tab cursor picker for Elementor.
 */
class KDNA_CC_Elementor {

	/**
	 * Set up the Elementor integration.
	 *
	 * Empty until Stage 7 wires in the Advanced-tab control.
	 *
	 * @return void
	 */
	public function __construct() {
		// Populated in Stage 7.
	}
}
