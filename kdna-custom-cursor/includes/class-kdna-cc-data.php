<?php
/**
 * Data layer for KDNA Custom Cursor.
 *
 * Reads, writes and sanitises the two plugin options. Everything is sanitised
 * on the way in and the stored structures always come back fully formed, so
 * the admin and the front end can trust the shape of the data.
 *
 * Two options are kept, deliberately separate so the library of cursors and
 * the class to cursor mapping can be edited independently:
 *   kdna_cc_cursors  the library, an array of saved cursor objects.
 *   kdna_cc_settings the assignment rules plus the option toggles.
 *
 * @package KDNA_Custom_Cursor
 */

// Stop anyone loading this file directly outside of WordPress.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Static helper class that owns all reading, writing and sanitising of options.
 */
class KDNA_CC_Data {

	/**
	 * Option name for the saved cursor library.
	 *
	 * @var string
	 */
	const CURSORS_OPTION = 'kdna_cc_cursors';

	/**
	 * Option name for the assignment rules and option toggles.
	 *
	 * @var string
	 */
	const SETTINGS_OPTION = 'kdna_cc_settings';

	/**
	 * The cursor types we accept.
	 *
	 * @return array List of allowed type slugs.
	 */
	private static function types() {
		return array( 'shape', 'image', 'text' );
	}

	/**
	 * The blend modes we accept, matching the controls reference in the brief.
	 *
	 * @return array List of allowed blend mode keywords.
	 */
	private static function blend_modes() {
		return array( 'normal', 'difference', 'multiply', 'screen', 'exclusion' );
	}

	/**
	 * The CSS transition timing functions we accept.
	 *
	 * @return array List of allowed timing keywords.
	 */
	private static function timings() {
		return array( 'ease', 'ease-out', 'ease-in-out', 'linear' );
	}

	/**
	 * The background shapes a Text cursor can sit inside.
	 *
	 * @return array List of allowed background shape keywords.
	 */
	private static function background_shapes() {
		return array( 'none', 'circle', 'pill' );
	}

	/* --------------------------------------------------------------------- */
	/* Read                                                                  */
	/* --------------------------------------------------------------------- */

	/**
	 * Get the saved cursor library.
	 *
	 * @return array Array of cursor objects, or an empty array if none saved.
	 */
	public static function get_cursors() {
		$cursors = get_option( self::CURSORS_OPTION, array() );

		// Guard against a corrupt or unexpected stored value.
		if ( ! is_array( $cursors ) ) {
			return array();
		}

		return $cursors;
	}

	/**
	 * Get a single saved cursor by its id.
	 *
	 * @param string $id The cursor id to find.
	 * @return array|null The cursor, or null when it does not exist.
	 */
	public static function get_cursor( $id ) {
		if ( empty( $id ) ) {
			return null;
		}

		foreach ( self::get_cursors() as $cursor ) {
			if ( isset( $cursor['id'] ) && $cursor['id'] === $id ) {
				return $cursor;
			}
		}

		return null;
	}

	/**
	 * Get the settings, always merged with defaults so every key is present.
	 *
	 * @return array The settings array with global cursor, rules and options.
	 */
	public static function get_settings() {
		$settings = get_option( self::SETTINGS_OPTION, array() );

		// Guard against a corrupt or unexpected stored value.
		if ( ! is_array( $settings ) ) {
			$settings = array();
		}

		return self::merge_settings_defaults( $settings );
	}

	/* --------------------------------------------------------------------- */
	/* Write                                                                 */
	/* --------------------------------------------------------------------- */

	/**
	 * Sanitise then save the cursor library.
	 *
	 * @param array $cursors Raw array of cursor objects from the request.
	 * @return array The cleaned array that was actually stored.
	 */
	public static function save_cursors( $cursors ) {
		$clean = self::sanitize_cursors( $cursors );
		update_option( self::CURSORS_OPTION, $clean );
		return $clean;
	}

	/**
	 * Sanitise then save the settings.
	 *
	 * @param array $settings Raw settings array from the request.
	 * @return array The cleaned settings that were actually stored.
	 */
	public static function save_settings( $settings ) {
		$clean = self::sanitize_settings( $settings );
		update_option( self::SETTINGS_OPTION, $clean );
		return $clean;
	}

	/**
	 * Make sure both options exist. Called on activation.
	 *
	 * @return void
	 */
	public static function ensure_options() {
		// Add an empty library if one has never been created.
		if ( false === get_option( self::CURSORS_OPTION, false ) ) {
			add_option( self::CURSORS_OPTION, array() );
		}

		// Add the default settings if they have never been created.
		if ( false === get_option( self::SETTINGS_OPTION, false ) ) {
			add_option( self::SETTINGS_OPTION, self::default_settings() );
		}
	}

	/* --------------------------------------------------------------------- */
	/* Defaults                                                              */
	/* --------------------------------------------------------------------- */

	/**
	 * The default settings structure.
	 *
	 * @return array Default global cursor, rules and option toggles.
	 */
	public static function default_settings() {
		return array(
			'globalCursorId' => null,
			'rules'          => array(),
			'options'        => array(
				'showNativeCursor'     => true,
				'hideOnTablet'         => true,
				'hideOnMobile'         => true,
				'hideInAdmin'          => true,
				'respectReducedMotion' => true,
			),
		);
	}

	/**
	 * Merge a stored settings array over the defaults so no key is ever missing.
	 *
	 * @param array $settings The stored settings array.
	 * @return array The settings with every expected key present.
	 */
	private static function merge_settings_defaults( $settings ) {
		$defaults = self::default_settings();

		// Fill any missing top level keys from the defaults.
		$merged = wp_parse_args( $settings, $defaults );

		// Fill any missing option toggles from the default options.
		$merged['options'] = wp_parse_args(
			( isset( $settings['options'] ) && is_array( $settings['options'] ) ) ? $settings['options'] : array(),
			$defaults['options']
		);

		// Rules must always be an array.
		if ( ! isset( $merged['rules'] ) || ! is_array( $merged['rules'] ) ) {
			$merged['rules'] = array();
		}

		return $merged;
	}

	/* --------------------------------------------------------------------- */
	/* Sanitise: cursors                                                     */
	/* --------------------------------------------------------------------- */

	/**
	 * Sanitise a whole array of cursor objects.
	 *
	 * @param array $cursors Raw array of cursor objects.
	 * @return array Cleaned array of cursor objects.
	 */
	public static function sanitize_cursors( $cursors ) {
		// Anything that is not a list of cursors becomes an empty library.
		if ( ! is_array( $cursors ) ) {
			return array();
		}

		$clean = array();

		// Clean each cursor and drop anything that cannot be understood.
		foreach ( $cursors as $cursor ) {
			$clean_cursor = self::sanitize_cursor( $cursor );
			if ( null !== $clean_cursor ) {
				$clean[] = $clean_cursor;
			}
		}

		return $clean;
	}

	/**
	 * Sanitise a single cursor object into a complete, well formed structure.
	 *
	 * @param array $cursor Raw cursor object.
	 * @return array|null The cleaned cursor, or null if it was not an array.
	 */
	public static function sanitize_cursor( $cursor ) {
		if ( ! is_array( $cursor ) ) {
			return null;
		}

		// Work out the type first as the hover block mirrors it.
		$type = ( isset( $cursor['type'] ) && in_array( $cursor['type'], self::types(), true ) ) ? $cursor['type'] : 'shape';

		$clean = array(
			'id'   => self::sanitize_id( isset( $cursor['id'] ) ? $cursor['id'] : '' ),
			'name' => isset( $cursor['name'] ) ? sanitize_text_field( $cursor['name'] ) : '',
			'type' => $type,
		);

		// Keep all three type blocks so switching type in the builder loses nothing.
		$clean['shape'] = self::sanitize_shape_block( isset( $cursor['shape'] ) ? $cursor['shape'] : array() );
		$clean['image'] = self::sanitize_image_block( isset( $cursor['image'] ) ? $cursor['image'] : array() );
		$clean['text']  = self::sanitize_text_block( isset( $cursor['text'] ) ? $cursor['text'] : array() );

		// The hover block holds the cursor's own Hover state for its type.
		$clean['hover'] = self::sanitize_hover_block( isset( $cursor['hover'] ) ? $cursor['hover'] : array(), $type );

		// What triggers the cursor's own internal hover state.
		$clean['hoverSelector'] = self::sanitize_selector( isset( $cursor['hoverSelector'] ) ? $cursor['hoverSelector'] : 'a, button' );

		return $clean;
	}

	/**
	 * Sanitise a hover block, matching the structure of the cursor's type.
	 *
	 * @param array  $raw  Raw hover block.
	 * @param string $type The cursor type the hover state belongs to.
	 * @return array Cleaned hover block for that type.
	 */
	private static function sanitize_hover_block( $raw, $type ) {
		switch ( $type ) {
			case 'image':
				return self::sanitize_image_block( $raw );
			case 'text':
				return self::sanitize_text_block( $raw );
			case 'shape':
			default:
				return self::sanitize_shape_block( $raw );
		}
	}

	/**
	 * Sanitise a Shape block, which is an inner and an outer layer.
	 *
	 * @param array $raw Raw shape block.
	 * @return array Cleaned shape block with inner and outer layers.
	 */
	private static function sanitize_shape_block( $raw ) {
		if ( ! is_array( $raw ) ) {
			$raw = array();
		}

		return array(
			'inner' => self::sanitize_layer( isset( $raw['inner'] ) ? $raw['inner'] : array(), false ),
			'outer' => self::sanitize_layer( isset( $raw['outer'] ) ? $raw['outer'] : array(), true ),
		);
	}

	/**
	 * Sanitise a single Shape layer (inner or outer) with all of its controls.
	 *
	 * @param array $raw      Raw layer values.
	 * @param bool  $is_outer True for the outer layer, which also carries velocity.
	 * @return array Cleaned layer values.
	 */
	private static function sanitize_layer( $raw, $is_outer ) {
		if ( ! is_array( $raw ) ) {
			$raw = array();
		}

		$layer = array(
			'width'              => self::sanitize_number( $raw, 'width', $is_outer ? 44 : 12, 0, 2000 ),
			'height'             => self::sanitize_number( $raw, 'height', $is_outer ? 44 : 12, 0, 2000 ),
			'color'              => self::sanitize_color_field( $raw, 'color', $is_outer ? 'transparent' : '#ffffff' ),
			'borderWidth'        => self::sanitize_number( $raw, 'borderWidth', $is_outer ? 1 : 0, 0, 100 ),
			'borderRadius'       => self::sanitize_length_field( $raw, 'borderRadius', '100%' ),
			'borderColor'        => self::sanitize_color_field( $raw, 'borderColor', $is_outer ? '#ffffff' : 'transparent' ),
			'transitionDuration' => (int) self::sanitize_number( $raw, 'transitionDuration', 150, 0, 5000 ),
			'transitionTiming'   => self::sanitize_enum( $raw, 'transitionTiming', self::timings(), 'ease-out' ),
			'blendMode'          => self::sanitize_enum( $raw, 'blendMode', self::blend_modes(), 'normal' ),
			'zIndex'             => (int) self::sanitize_number( $raw, 'zIndex', $is_outer ? 101 : 100, 0, 2147483647 ),
			'backdropFilter'     => self::sanitize_css_token( isset( $raw['backdropFilter'] ) ? $raw['backdropFilter'] : '' ),
		);

		// Only the outer layer has a velocity (trail) amount, kept between 0 and 1.
		if ( $is_outer ) {
			$layer['velocity'] = self::clamp_float( isset( $raw['velocity'] ) ? $raw['velocity'] : 0.15, 0, 1 );
		}

		return $layer;
	}

	/**
	 * Sanitise an Image block.
	 *
	 * @param array $raw Raw image block.
	 * @return array Cleaned image block.
	 */
	private static function sanitize_image_block( $raw ) {
		if ( ! is_array( $raw ) ) {
			$raw = array();
		}

		return array(
			'url'          => isset( $raw['url'] ) ? esc_url_raw( (string) $raw['url'] ) : '',
			'attachmentId' => (int) self::sanitize_number( $raw, 'attachmentId', 0, 0, 2147483647 ),
			'width'        => self::sanitize_number( $raw, 'width', 40, 0, 2000 ),
			'height'       => self::sanitize_number( $raw, 'height', 40, 0, 2000 ),
			'blendMode'    => self::sanitize_enum( $raw, 'blendMode', self::blend_modes(), 'normal' ),
			'zIndex'       => (int) self::sanitize_number( $raw, 'zIndex', 100, 0, 2147483647 ),
		);
	}

	/**
	 * Sanitise a Text block, including its optional background shape.
	 *
	 * @param array $raw Raw text block.
	 * @return array Cleaned text block.
	 */
	private static function sanitize_text_block( $raw ) {
		if ( ! is_array( $raw ) ) {
			$raw = array();
		}

		// The background is its own little sub object.
		$bg = ( isset( $raw['background'] ) && is_array( $raw['background'] ) ) ? $raw['background'] : array();

		return array(
			'value'      => isset( $raw['value'] ) ? sanitize_text_field( (string) $raw['value'] ) : '',
			'font'       => self::sanitize_font( isset( $raw['font'] ) ? $raw['font'] : '' ),
			'size'       => self::sanitize_number( $raw, 'size', 16, 0, 500 ),
			'color'      => self::sanitize_color_field( $raw, 'color', '#ffffff' ),
			'weight'     => self::sanitize_font_weight( isset( $raw['weight'] ) ? $raw['weight'] : 'normal' ),
			'blendMode'  => self::sanitize_enum( $raw, 'blendMode', self::blend_modes(), 'normal' ),
			'zIndex'     => (int) self::sanitize_number( $raw, 'zIndex', 100, 0, 2147483647 ),
			'background' => array(
				'shape'        => self::sanitize_enum( $bg, 'shape', self::background_shapes(), 'none' ),
				'width'        => self::sanitize_number( $bg, 'width', 70, 0, 2000 ),
				'height'       => self::sanitize_number( $bg, 'height', 70, 0, 2000 ),
				'fill'         => self::sanitize_color_field( $bg, 'fill', '#808080' ),
				'fillOpacity'  => (int) self::sanitize_number( $bg, 'fillOpacity', 100, 0, 100 ),
				'borderWidth'  => self::sanitize_number( $bg, 'borderWidth', 0, 0, 100 ),
				'borderColor'  => self::sanitize_color_field( $bg, 'borderColor', 'transparent' ),
				'borderRadius' => self::sanitize_length_field( $bg, 'borderRadius', '100%' ),
			),
		);
	}

	/* --------------------------------------------------------------------- */
	/* Sanitise: settings                                                    */
	/* --------------------------------------------------------------------- */

	/**
	 * Sanitise the settings array (global cursor, rules and option toggles).
	 *
	 * @param array $settings Raw settings array.
	 * @return array Cleaned settings array.
	 */
	public static function sanitize_settings( $settings ) {
		if ( ! is_array( $settings ) ) {
			$settings = array();
		}

		$defaults = self::default_settings();
		$clean    = array();

		// The optional site-wide cursor, stored as a loose id or null.
		$global                    = isset( $settings['globalCursorId'] ) ? $settings['globalCursorId'] : null;
		$global                    = self::sanitize_id_reference( $global );
		$clean['globalCursorId']   = ( '' === $global ) ? null : $global;

		// The ordered list of class to cursor rules, first match wins.
		$clean['rules'] = array();
		if ( isset( $settings['rules'] ) && is_array( $settings['rules'] ) ) {
			foreach ( $settings['rules'] as $rule ) {
				if ( ! is_array( $rule ) ) {
					continue;
				}

				$selector  = self::sanitize_selector( isset( $rule['selector'] ) ? $rule['selector'] : '' );
				$cursor_id = self::sanitize_id_reference( isset( $rule['cursorId'] ) ? $rule['cursorId'] : '' );

				// A rule with no selector is meaningless, so skip it.
				if ( '' === $selector ) {
					continue;
				}

				$clean['rules'][] = array(
					'selector' => $selector,
					'cursorId' => $cursor_id,
				);
			}
		}

		// The option toggles, each forced to a strict boolean.
		$raw_options       = ( isset( $settings['options'] ) && is_array( $settings['options'] ) ) ? $settings['options'] : array();
		$clean['options']  = array();
		foreach ( $defaults['options'] as $key => $default_value ) {
			$clean['options'][ $key ] = isset( $raw_options[ $key ] ) ? (bool) $raw_options[ $key ] : $default_value;
		}

		return $clean;
	}

	/* --------------------------------------------------------------------- */
	/* Sanitise: small field helpers                                         */
	/* --------------------------------------------------------------------- */

	/**
	 * Sanitise a numeric field, clamped to an optional minimum and maximum.
	 *
	 * @param array      $raw     The source array.
	 * @param string     $key     The key to read.
	 * @param float|int  $default The fallback when the value is missing or invalid.
	 * @param float|null $min     Optional lower bound.
	 * @param float|null $max     Optional upper bound.
	 * @return float The cleaned, clamped number.
	 */
	private static function sanitize_number( $raw, $key, $default, $min = null, $max = null ) {
		$value = ( isset( $raw[ $key ] ) && is_numeric( $raw[ $key ] ) ) ? (float) $raw[ $key ] : (float) $default;

		if ( null !== $min && $value < $min ) {
			$value = (float) $min;
		}
		if ( null !== $max && $value > $max ) {
			$value = (float) $max;
		}

		return $value;
	}

	/**
	 * Clamp any value to a float between a minimum and a maximum.
	 *
	 * @param mixed $value The incoming value.
	 * @param float $min   Lower bound.
	 * @param float $max   Upper bound.
	 * @return float The clamped float.
	 */
	private static function clamp_float( $value, $min, $max ) {
		$value = is_numeric( $value ) ? (float) $value : (float) $min;

		if ( $value < $min ) {
			$value = (float) $min;
		}
		if ( $value > $max ) {
			$value = (float) $max;
		}

		return $value;
	}

	/**
	 * Sanitise a value against a whitelist, falling back to a default.
	 *
	 * @param array  $raw     The source array.
	 * @param string $key     The key to read.
	 * @param array  $allowed The allowed values.
	 * @param string $default The fallback when the value is not allowed.
	 * @return string The cleaned value.
	 */
	private static function sanitize_enum( $raw, $key, $allowed, $default ) {
		$value = isset( $raw[ $key ] ) ? (string) $raw[ $key ] : '';
		return in_array( $value, $allowed, true ) ? $value : $default;
	}

	/**
	 * Sanitise a colour field, allowing hex, rgb(a), hsl(a), named or transparent.
	 *
	 * @param array  $raw     The source array.
	 * @param string $key     The key to read.
	 * @param string $default The fallback when the colour is empty or invalid.
	 * @return string The cleaned colour, or the default.
	 */
	private static function sanitize_color_field( $raw, $key, $default ) {
		if ( ! isset( $raw[ $key ] ) ) {
			return $default;
		}

		$clean = self::sanitize_color( (string) $raw[ $key ] );
		return ( '' === $clean ) ? $default : $clean;
	}

	/**
	 * Sanitise a single colour string.
	 *
	 * Accepts the transparent keyword, hex with optional alpha, the rgb, rgba,
	 * hsl and hsla functional forms, and plain named colours. Anything else is
	 * rejected and returned as an empty string.
	 *
	 * @param string $value The raw colour string.
	 * @return string The cleaned colour, or an empty string if not recognised.
	 */
	private static function sanitize_color( $value ) {
		$value = trim( (string) $value );

		if ( '' === $value ) {
			return '';
		}

		// The transparent keyword is always allowed.
		if ( 'transparent' === strtolower( $value ) ) {
			return 'transparent';
		}

		// Hex colours, three, four, six or eight digits.
		if ( preg_match( '/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $value ) ) {
			return $value;
		}

		// Functional rgb, rgba, hsl and hsla notation.
		if ( preg_match( '/^(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s\/]+\)$/i', $value ) ) {
			return $value;
		}

		// Simple named colours, letters only.
		if ( preg_match( '/^[a-zA-Z]+$/', $value ) ) {
			return strtolower( $value );
		}

		// Anything else is not a colour we are willing to store.
		return '';
	}

	/**
	 * Sanitise a CSS length, such as a border radius, allowing common units.
	 *
	 * @param array  $raw     The source array.
	 * @param string $key     The key to read.
	 * @param string $default The fallback when the value is empty or invalid.
	 * @return string The cleaned length string.
	 */
	private static function sanitize_length_field( $raw, $key, $default ) {
		if ( ! isset( $raw[ $key ] ) ) {
			return $default;
		}

		$value = trim( (string) $raw[ $key ] );
		if ( '' === $value ) {
			return $default;
		}

		// A number with an optional unit, for example 12, 12px, 100% or 0.5em.
		if ( preg_match( '/^-?\d*\.?\d+\s*(px|%|em|rem|vh|vw)?$/', $value ) ) {
			return $value;
		}

		return $default;
	}

	/**
	 * Sanitise a small CSS token such as a backdrop filter value.
	 *
	 * Keeps only a safe set of characters and caps the length so stored values
	 * stay sensible. Examples this allows: blur(2px), brightness(0.8).
	 *
	 * @param string $value The raw token.
	 * @return string The cleaned token.
	 */
	private static function sanitize_css_token( $value ) {
		$value = trim( (string) $value );
		if ( '' === $value ) {
			return '';
		}

		// Strip anything outside a safe set of CSS function characters.
		$value = preg_replace( '/[^a-zA-Z0-9#%.,()\s\/-]/', '', $value );

		return substr( $value, 0, 200 );
	}

	/**
	 * Sanitise a font family string for a Text cursor.
	 *
	 * @param string $value The raw font family.
	 * @return string The cleaned font family.
	 */
	private static function sanitize_font( $value ) {
		$value = trim( (string) $value );
		if ( '' === $value ) {
			return '';
		}

		// Allow letters, numbers, spaces, commas, hyphens and quotes for stacks.
		$value = preg_replace( '/[^a-zA-Z0-9 ,\'"-]/', '', $value );

		return substr( $value, 0, 200 );
	}

	/**
	 * Sanitise a font weight, allowing keywords or the 100 to 900 numeric scale.
	 *
	 * @param string $value The raw weight.
	 * @return string The cleaned weight.
	 */
	private static function sanitize_font_weight( $value ) {
		$value = trim( (string) $value );

		// The common keyword weights.
		if ( in_array( $value, array( 'normal', 'bold', 'bolder', 'lighter' ), true ) ) {
			return $value;
		}

		// The numeric scale, 100 through 900.
		if ( preg_match( '/^[1-9]00$/', $value ) ) {
			return $value;
		}

		return 'normal';
	}

	/**
	 * Sanitise a cursor id, generating a fresh one if it is missing or malformed.
	 *
	 * Stored cursors always carry an id in the form kdna-cc-<uuid>.
	 *
	 * @param string $value The raw id.
	 * @return string A valid cursor id.
	 */
	private static function sanitize_id( $value ) {
		$value = preg_replace( '/[^a-zA-Z0-9-]/', '', (string) $value );

		// Generate a new id if it is empty or does not use our prefix.
		if ( '' === $value || 0 !== strpos( $value, 'kdna-cc-' ) ) {
			$value = 'kdna-cc-' . wp_generate_uuid4();
		}

		return $value;
	}

	/**
	 * Sanitise an id that references a cursor (a global cursor or a rule target).
	 *
	 * Unlike sanitize_id this never invents a new id, it just strips unsafe
	 * characters and may return an empty string when nothing is referenced.
	 *
	 * @param string $value The raw id reference.
	 * @return string The cleaned id, possibly empty.
	 */
	private static function sanitize_id_reference( $value ) {
		if ( empty( $value ) ) {
			return '';
		}

		return preg_replace( '/[^a-zA-Z0-9-]/', '', (string) $value );
	}

	/**
	 * Sanitise a CSS selector used for hover triggers and assignment rules.
	 *
	 * Keeps the characters that make up real selectors and caps the length.
	 *
	 * @param string $value The raw selector.
	 * @return string The cleaned selector.
	 */
	private static function sanitize_selector( $value ) {
		$value = trim( (string) $value );
		if ( '' === $value ) {
			return '';
		}

		// Allow the characters that appear in CSS selectors.
		$value = preg_replace( '/[^a-zA-Z0-9 .,#_>+~\[\]="\':()*-]/', '', $value );

		return substr( $value, 0, 500 );
	}
}
