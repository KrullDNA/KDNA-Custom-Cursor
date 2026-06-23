<?php
/**
 * Starter preset definitions for KDNA Custom Cursor.
 *
 * Holds the original KDNA preset cursors that seed the library, including the
 * three target cursors from the brief: Dot + bar, View and Scroll. Implemented
 * in Stage 6. Placeholder for Stage 1 so the file structure in the brief is in
 * place. Not loaded by the core until Stage 6.
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
 * Provides the starter preset cursor definitions.
 */
class KDNA_CC_Presets {

	/**
	 * Get the starter preset cursors.
	 *
	 * Returns an empty array until Stage 6 fills in the original KDNA presets.
	 *
	 * @return array List of preset cursor definitions.
	 */
	public static function get_presets() {
		return array();
	}
}
