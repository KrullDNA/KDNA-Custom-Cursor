<?php
/**
 * Starter preset definitions for KDNA Custom Cursor.
 *
 * Original KDNA preset cursors that seed the Library. Choosing one creates a new
 * editable cursor. Includes the three target cursors from the brief, Dot + bar,
 * View and Scroll, plus a couple of extra originals. Each definition is passed
 * through the data layer's sanitiser so it comes back as a complete, valid
 * cursor object that matches the stored structure exactly.
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
	 * Get the starter preset cursors, fully formed and sanitised.
	 *
	 * @return array List of preset cursor objects.
	 */
	public static function get_presets() {
		$presets = array();

		// Run each raw definition through the sanitiser so any field we leave
		// out is filled with its default and the structure is always complete.
		foreach ( self::definitions() as $definition ) {
			$presets[] = KDNA_CC_Data::sanitize_cursor( $definition );
		}

		return $presets;
	}

	/**
	 * The raw preset definitions. Only the fields that matter are set, the rest
	 * are filled by the sanitiser.
	 *
	 * @return array List of raw preset definitions.
	 */
	private static function definitions() {
		return array(

			// Dot + bar. A small white dash with a trailing ring, inverting
			// against whatever sits beneath it.
			array(
				'id'    => 'kdna-cc-preset-dot-bar',
				'name'  => 'Dot + bar',
				'type'  => 'shape',
				'shape' => array(
					'inner' => array(
						'width'        => 12,
						'height'       => 4,
						'color'        => '#ffffff',
						'borderRadius' => '2px',
						'blendMode'    => 'difference',
						'zIndex'       => 100,
					),
					'outer' => array(
						'width'        => 44,
						'height'       => 44,
						'color'        => 'transparent',
						'borderWidth'  => 1,
						'borderColor'  => '#ffffff',
						'borderRadius' => '100%',
						'blendMode'    => 'difference',
						'zIndex'       => 101,
						'velocity'     => 0.18,
					),
				),
				'hover' => array(
					'inner' => array(
						'width'        => 12,
						'height'       => 4,
						'color'        => '#ffffff',
						'borderRadius' => '2px',
						'blendMode'    => 'difference',
					),
					'outer' => array(
						'width'        => 64,
						'height'       => 64,
						'color'        => 'transparent',
						'borderWidth'  => 1,
						'borderColor'  => '#ffffff',
						'borderRadius' => '100%',
						'blendMode'    => 'difference',
						'velocity'     => 0.22,
					),
				),
				'hoverSelector' => 'a, button',
			),

			// Ring trail. An outline ring with a small dot and a longer trail.
			array(
				'id'    => 'kdna-cc-preset-ring-trail',
				'name'  => 'Ring trail',
				'type'  => 'shape',
				'shape' => array(
					'inner' => array(
						'width'     => 8,
						'height'    => 8,
						'color'     => '#ffffff',
						'blendMode' => 'difference',
						'zIndex'    => 100,
					),
					'outer' => array(
						'width'        => 40,
						'height'       => 40,
						'color'        => 'transparent',
						'borderWidth'  => 1,
						'borderColor'  => '#ffffff',
						'borderRadius' => '100%',
						'blendMode'    => 'difference',
						'zIndex'       => 101,
						'velocity'     => 0.3,
					),
				),
				'hover' => array(
					'inner' => array(
						'width'     => 8,
						'height'    => 8,
						'color'     => '#ffffff',
						'blendMode' => 'difference',
					),
					'outer' => array(
						'width'        => 56,
						'height'       => 56,
						'color'        => 'transparent',
						'borderWidth'  => 1,
						'borderColor'  => '#ffffff',
						'borderRadius' => '100%',
						'blendMode'    => 'difference',
						'velocity'     => 0.3,
					),
				),
				'hoverSelector' => 'a, button',
			),

			// Terracotta dot. A soft filled brand dot with no ring.
			array(
				'id'    => 'kdna-cc-preset-terracotta-dot',
				'name'  => 'Terracotta dot',
				'type'  => 'shape',
				'shape' => array(
					'inner' => array(
						'width'  => 16,
						'height' => 16,
						'color'  => '#c8553d',
						'zIndex' => 101,
					),
					'outer' => array(
						'width'    => 0,
						'height'   => 0,
						'color'    => 'transparent',
						'velocity' => 0,
						'zIndex'   => 100,
					),
				),
				'hover' => array(
					'inner' => array(
						'width'  => 26,
						'height' => 26,
						'color'  => '#c8553d',
						'zIndex' => 101,
					),
					'outer' => array(
						'width'    => 0,
						'height'   => 0,
						'velocity' => 0,
					),
				),
				'hoverSelector' => 'a, button',
			),

			// View. A word inside a solid grey circle, shrinking on hover.
			array(
				'id'    => 'kdna-cc-preset-view',
				'name'  => 'View',
				'type'  => 'text',
				'text'  => array(
					'value'      => 'View',
					'size'       => 16,
					'color'      => '#ffffff',
					'weight'     => '600',
					'zIndex'     => 101,
					'background' => array(
						'shape'  => 'circle',
						'width'  => 72,
						'height' => 72,
						'fill'   => '#7a7f87',
					),
				),
				'hover' => array(
					'value'      => 'View',
					'size'       => 16,
					'color'      => '#ffffff',
					'weight'     => '600',
					'zIndex'     => 101,
					'background' => array(
						'shape'  => 'circle',
						'width'  => 58,
						'height' => 58,
						'fill'   => '#7a7f87',
					),
				),
				'hoverSelector' => 'a, button',
			),

			// Scroll. The same circle carrying the word Scroll.
			array(
				'id'    => 'kdna-cc-preset-scroll',
				'name'  => 'Scroll',
				'type'  => 'text',
				'text'  => array(
					'value'      => 'Scroll',
					'size'       => 15,
					'color'      => '#ffffff',
					'weight'     => '600',
					'zIndex'     => 101,
					'background' => array(
						'shape'  => 'circle',
						'width'  => 72,
						'height' => 72,
						'fill'   => '#7a7f87',
					),
				),
				'hover' => array(
					'value'      => 'Scroll',
					'size'       => 15,
					'color'      => '#ffffff',
					'weight'     => '600',
					'zIndex'     => 101,
					'background' => array(
						'shape'  => 'circle',
						'width'  => 58,
						'height' => 58,
						'fill'   => '#7a7f87',
					),
				),
				'hoverSelector' => 'a, button',
			),

		);
	}
}
