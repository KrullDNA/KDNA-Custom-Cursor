<?php
/**
 * Uninstall handler for KDNA Custom Cursor.
 *
 * Runs only when the plugin is deleted from the Plugins screen. Removes the two
 * options so nothing is left behind. Handles a multisite network by clearing
 * the options on every site.
 *
 * @package KDNA_Custom_Cursor
 */

// Only run when WordPress itself is uninstalling the plugin.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// The options this plugin owns.
$kdna_cc_options = array( 'kdna_cc_cursors', 'kdna_cc_settings' );

/**
 * Delete this plugin's options from the current site.
 *
 * @param array $option_names The option names to remove.
 * @return void
 */
function kdna_cc_delete_options( $option_names ) {
	foreach ( $option_names as $option_name ) {
		delete_option( $option_name );
	}
}

if ( is_multisite() ) {
	// Clear the options on every site in the network.
	$kdna_cc_sites = get_sites( array( 'number' => 0 ) );

	foreach ( $kdna_cc_sites as $kdna_cc_site ) {
		switch_to_blog( (int) $kdna_cc_site->blog_id );
		kdna_cc_delete_options( $kdna_cc_options );
		restore_current_blog();
	}
} else {
	// Single site, just clear the options here.
	kdna_cc_delete_options( $kdna_cc_options );
}
