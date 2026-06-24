<?php
/**
 * Optional Elementor integration for KDNA Custom Cursor.
 *
 * Adds a Cursor dropdown to the Advanced tab of Elementor sections, columns,
 * containers and widgets, listing the saved cursors. Choosing one applies that
 * cursor to the element without the designer typing a class: a generated
 * kdna-cc-bound class is added to the element when it renders, and a matching
 * internal rule is handed to the front-end engine, where it sits above the
 * manually mapped class rules so it does not conflict with them.
 *
 * The Elementor hooks are registered at file load time, in the constructor which
 * runs when the plugin loads, not inside elementor/loaded.
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
	 * The Elementor control name.
	 *
	 * @var string
	 */
	const CONTROL = 'kdna_cc_cursor';

	/**
	 * Register the Elementor hooks straight away.
	 *
	 * These are added at load time, not inside elementor/loaded. When Elementor
	 * is not active the hooks simply never fire.
	 */
	public function __construct() {
		// Add the control to the Advanced tab of every element type.
		add_action( 'elementor/element/after_section_end', array( $this, 'register_cursor_section' ), 10, 3 );

		// Add the generated class to bound elements as they render on the front end.
		add_action( 'elementor/frontend/before_render', array( $this, 'add_bound_class' ) );
	}

	/**
	 * The generated class for a bound element.
	 *
	 * @param string $element_id The Elementor element id.
	 * @return string The kdna-cc-bound class.
	 */
	public static function bound_class( $element_id ) {
		return 'kdna-cc-bound-' . preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) $element_id );
	}

	/**
	 * Whether this section end is where we should inject our control section.
	 *
	 * The widget Advanced tab uses the common _section_style section, which is
	 * unique to widgets. Sections and columns use section_advanced. Containers
	 * use section_layout.
	 *
	 * @param object $element    The Elementor element.
	 * @param string $section_id The section that just ended.
	 * @return bool True if this is our anchor point.
	 */
	private function is_anchor( $element, $section_id ) {
		if ( '_section_style' === $section_id ) {
			return true;
		}

		$type = method_exists( $element, 'get_type' ) ? $element->get_type() : '';

		if ( 'section_advanced' === $section_id && in_array( $type, array( 'section', 'column' ), true ) ) {
			return true;
		}
		if ( 'section_layout' === $section_id && 'container' === $type ) {
			return true;
		}

		return false;
	}

	/**
	 * Register the cursor section and dropdown in the Advanced tab.
	 *
	 * @param object $element    The Elementor element.
	 * @param string $section_id The section that just ended.
	 * @param array  $args       The section arguments.
	 * @return void
	 */
	public function register_cursor_section( $element, $section_id, $args ) {
		if ( ! $this->is_anchor( $element, $section_id ) ) {
			return;
		}

		$element->start_controls_section(
			'kdna_cc_section',
			array(
				'label' => __( 'KDNA Custom Cursor', 'kdna-custom-cursor' ),
				'tab'   => \Elementor\Controls_Manager::TAB_ADVANCED,
			)
		);

		$element->add_control(
			self::CONTROL,
			array(
				'label'       => __( 'Cursor', 'kdna-custom-cursor' ),
				'type'        => \Elementor\Controls_Manager::SELECT,
				'options'     => $this->cursor_options(),
				'default'     => '',
				'description' => __( 'Apply a saved KDNA cursor to this element. A class and a matching rule are added for you, with no need to type a class.', 'kdna-custom-cursor' ),
			)
		);

		$element->end_controls_section();
	}

	/**
	 * The dropdown options: a default entry plus every saved cursor.
	 *
	 * @return array Map of cursor id to name.
	 */
	private function cursor_options() {
		$options = array( '' => __( 'Default', 'kdna-custom-cursor' ) );

		foreach ( KDNA_CC_Data::get_cursors() as $cursor ) {
			if ( isset( $cursor['id'] ) ) {
				$name                       = ( isset( $cursor['name'] ) && '' !== $cursor['name'] ) ? $cursor['name'] : $cursor['id'];
				$options[ $cursor['id'] ]   = $name;
			}
		}

		return $options;
	}

	/**
	 * Add the generated class to a bound element when it renders.
	 *
	 * @param object $element The Elementor element being rendered.
	 * @return void
	 */
	public function add_bound_class( $element ) {
		$cursor_id = $element->get_settings_for_display( self::CONTROL );
		if ( empty( $cursor_id ) ) {
			return;
		}

		// Add the class to the element's outer wrapper. The outer wrapper is
		// present in both the standard and the optimized markup output, so we do
		// not rely on the widget inner wrapper, which can be removed when the
		// e_optimized_markup experiment is active and has_widget_inner_wrapper
		// is false.
		$element->add_render_attribute( '_wrapper', 'class', self::bound_class( $element->get_id() ) );
	}

	/* --------------------------------------------------------------------- */
	/* Front-end bindings                                                    */
	/* --------------------------------------------------------------------- */

	/**
	 * Collect the cursor bindings for the current page by walking its Elementor
	 * document. Each binding is the generated class plus the chosen cursor id.
	 *
	 * @return array List of bindings, each with class and cursorId.
	 */
	public static function get_page_bindings() {
		$bindings = array();

		// Nothing to do unless Elementor is active.
		if ( ! class_exists( '\\Elementor\\Plugin' ) ) {
			return $bindings;
		}

		$post_id = get_queried_object_id();
		if ( ! $post_id ) {
			return $bindings;
		}

		$plugin = \Elementor\Plugin::$instance;
		if ( ! $plugin || ! isset( $plugin->documents ) ) {
			return $bindings;
		}

		$document = $plugin->documents->get( $post_id );
		if ( ! $document || ! $document->is_built_with_elementor() ) {
			return $bindings;
		}

		self::collect_bindings( $document->get_elements_data(), $bindings );

		return $bindings;
	}

	/**
	 * Walk the element data, gathering bindings from any element that has the
	 * cursor control set.
	 *
	 * @param array $elements The element data.
	 * @param array $bindings The bindings collected so far, by reference.
	 * @return void
	 */
	private static function collect_bindings( $elements, &$bindings ) {
		if ( ! is_array( $elements ) ) {
			return;
		}

		foreach ( $elements as $element ) {
			if ( isset( $element['settings'][ self::CONTROL ] ) && '' !== $element['settings'][ self::CONTROL ] && isset( $element['id'] ) ) {
				$bindings[] = array(
					'class'    => self::bound_class( $element['id'] ),
					'cursorId' => $element['settings'][ self::CONTROL ],
				);
			}

			if ( ! empty( $element['elements'] ) ) {
				self::collect_bindings( $element['elements'], $bindings );
			}
		}
	}
}
