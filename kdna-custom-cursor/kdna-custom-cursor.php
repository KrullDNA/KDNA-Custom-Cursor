<?php
/**
 * Plugin Name:       KDNA Custom Cursor
 * Plugin URI:        https://krulldna.com/
 * Description:       Build custom animated cursors in the WordPress admin and assign them to specific CSS classes on your Elementor pages, with an optional site-wide global cursor.
 * Version:           1.0.4
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            KDNA
 * Author URI:        https://krulldna.com/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       kdna-custom-cursor
 * Domain Path:       /languages
 *
 * KDNA Custom Cursor. Build custom cursors and map them to CSS classes.
 * UK English throughout. No em dashes anywhere in this codebase.
 *
 * @package KDNA_Custom_Cursor
 */

// Stop anyone loading this file directly outside of WordPress.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Plugin version. Kept in one place so assets and the readme stay in step.
define( 'KDNA_CC_VERSION', '1.0.4' );

// Absolute path to this main plugin file.
define( 'KDNA_CC_FILE', __FILE__ );

// Server path to the plugin folder, with a trailing slash.
define( 'KDNA_CC_DIR', plugin_dir_path( __FILE__ ) );

// Public URL to the plugin folder, with a trailing slash.
define( 'KDNA_CC_URL', plugin_dir_url( __FILE__ ) );

// The plugin basename, used by activation and settings links.
define( 'KDNA_CC_BASENAME', plugin_basename( __FILE__ ) );

// Load the data layer first so activation and the admin can both use it.
require_once KDNA_CC_DIR . 'includes/class-kdna-cc-data.php';

// Load the bootstrap class that wires everything together.
require_once KDNA_CC_DIR . 'includes/class-kdna-cc-core.php';

/**
 * Run on activation. Make sure both options exist with sensible defaults.
 *
 * @return void
 */
function kdna_cc_activate() {
	KDNA_CC_Data::ensure_options();
}
register_activation_hook( __FILE__, 'kdna_cc_activate' );

/**
 * Run on deactivation. Nothing destructive happens here, options stay put.
 * Options are only removed by uninstall.php when the plugin is deleted.
 *
 * @return void
 */
function kdna_cc_deactivate() {
	// Intentionally left empty. We keep saved cursors on deactivation.
}
register_deactivation_hook( __FILE__, 'kdna_cc_deactivate' );

/**
 * Start the plugin once all other plugins have loaded.
 *
 * @return void
 */
function kdna_cc_bootstrap() {
	KDNA_CC_Core::instance();
}
add_action( 'plugins_loaded', 'kdna_cc_bootstrap' );
