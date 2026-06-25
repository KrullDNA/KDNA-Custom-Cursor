/**
 * Shared cursor engine for KDNA Custom Cursor.
 *
 * One engine drives both the admin live preview and the front end, so what you
 * build matches what visitors see. It renders a cursor as layered elements,
 * positions them with transform inside a single requestAnimationFrame loop, and
 * uses LERP smoothing for the outer layer's velocity trail. The loop cancels
 * itself when the pointer is idle and restarts on movement.
 *
 * Stage 2 implements the Shape cursor (inner plus outer) and the pointer engine
 * used by the preview. Stage 3 reuses this same engine on the front end, and
 * Stage 5 adds the Image and Text renderers.
 *
 * UK English throughout. No em dashes.
 */
( function () {
	'use strict';

	var KdnaCC = window.KdnaCC = window.KdnaCC || {};

	/* --------------------------------------------------------------------- */
	/* Small helpers                                                         */
	/* --------------------------------------------------------------------- */

	/**
	 * Parse a value as a float, falling back when it is not a number.
	 *
	 * @param {*} value The value to parse.
	 * @param {number} fallback The fallback when parsing fails.
	 * @return {number} The parsed number.
	 */
	function num( value, fallback ) {
		var n = parseFloat( value );
		return isNaN( n ) ? ( fallback || 0 ) : n;
	}

	/**
	 * Parse a value as an integer, falling back when it is not a number.
	 *
	 * @param {*} value The value to parse.
	 * @param {number} fallback The fallback when parsing fails.
	 * @return {number} The parsed integer.
	 */
	function intval( value, fallback ) {
		var n = parseInt( value, 10 );
		return isNaN( n ) ? ( fallback || 0 ) : n;
	}

	/**
	 * Clamp a number between a minimum and a maximum.
	 *
	 * @param {*} value The incoming value.
	 * @param {number} min Lower bound.
	 * @param {number} max Upper bound.
	 * @return {number} The clamped number.
	 */
	function clamp( value, min, max ) {
		value = num( value, min );
		if ( value < min ) {
			value = min;
		}
		if ( value > max ) {
			value = max;
		}
		return value;
	}

	/**
	 * Turn a stored length into a CSS value, defaulting bare numbers to px.
	 *
	 * @param {*} value The stored length, for example 12, 12px or 100%.
	 * @return {string} The CSS length.
	 */
	function cssLength( value ) {
		if ( value === null || value === undefined ) {
			return '0';
		}
		var s = String( value ).trim();
		if ( '' === s ) {
			return '0';
		}
		if ( /^-?\d*\.?\d+$/.test( s ) ) {
			return s + 'px';
		}
		return s;
	}

	/**
	 * Best effort conversion of a colour to a six digit hex for a colour swatch.
	 *
	 * @param {string} value The stored colour.
	 * @return {string} A hex colour, defaulting to black when not convertible.
	 */
	function toHex( value ) {
		if ( ! value ) {
			return '#000000';
		}
		var s = String( value ).trim();
		// Drop the alpha from an eight digit hex so the swatch shows the colour.
		if ( /^#[0-9a-fA-F]{8}$/.test( s ) ) {
			return s.substr( 0, 7 );
		}
		if ( /^#[0-9a-fA-F]{6}$/.test( s ) ) {
			return s;
		}
		if ( /^#[0-9a-fA-F]{3}$/.test( s ) ) {
			return '#' + s[ 1 ] + s[ 1 ] + s[ 2 ] + s[ 2 ] + s[ 3 ] + s[ 3 ];
		}
		return '#000000';
	}

	/* --------------------------------------------------------------------- */
	/* Styling a single shape layer                                          */
	/* --------------------------------------------------------------------- */

	/**
	 * Apply a shape layer's controls to an element.
	 *
	 * The transform is never set here, the rAF loop owns it. The transition is
	 * applied to the visual properties only so position stays smooth while a
	 * state swap (Normal to Hover) animates nicely.
	 *
	 * @param {HTMLElement} el The layer element.
	 * @param {Object} layer The layer control values.
	 * @return {void}
	 */
	function styleLayer( el, layer ) {
		if ( ! el || ! layer ) {
			return;
		}

		el.style.width = num( layer.width, 0 ) + 'px';
		el.style.height = num( layer.height, 0 ) + 'px';
		el.style.backgroundColor = layer.color || 'transparent';
		el.style.borderStyle = 'solid';
		el.style.borderWidth = num( layer.borderWidth, 0 ) + 'px';
		el.style.borderColor = layer.borderColor || 'transparent';
		el.style.borderRadius = cssLength( layer.borderRadius );
		el.style.mixBlendMode = layer.blendMode || 'normal';
		el.style.zIndex = intval( layer.zIndex, 100 );

		var bf = layer.backdropFilter || '';
		el.style.backdropFilter = bf;
		el.style.webkitBackdropFilter = bf;

		var dur = intval( layer.transitionDuration, 150 ) + 'ms';
		var tim = layer.transitionTiming || 'ease-out';
		el.style.transition = [
			'width ' + dur + ' ' + tim,
			'height ' + dur + ' ' + tim,
			'background-color ' + dur + ' ' + tim,
			'border-color ' + dur + ' ' + tim,
			'border-width ' + dur + ' ' + tim,
			'border-radius ' + dur + ' ' + tim,
			'backdrop-filter ' + dur + ' ' + tim
		].join( ', ' );
	}

	// The properties each cursor type transitions when swapping between its
	// Normal and Hover states.
	var IMAGE_TRANSITION_PROPS = [ 'width', 'height', 'opacity' ];
	var TEXT_TRANSITION_PROPS = [ 'width', 'height', 'background-color', 'color', 'font-size', 'backdrop-filter' ];

	/**
	 * Apply a single transition to an element for the given properties.
	 *
	 * This is read from the cursor's base block so both swap directions use the
	 * same easing, rather than the per-state value of whichever state is being
	 * applied.
	 *
	 * @param {HTMLElement} el       The element.
	 * @param {number} duration      The duration in milliseconds.
	 * @param {string} timing        The timing function.
	 * @param {Array} props          The CSS properties to transition.
	 * @return {void}
	 */
	function applyTransition( el, duration, timing, props ) {
		var dur = intval( duration, 150 ) + 'ms';
		var tim = timing || 'ease-out';
		var parts = [];
		for ( var i = 0; i < props.length; i++ ) {
			parts.push( props[ i ] + ' ' + dur + ' ' + tim );
		}
		el.style.transition = parts.join( ', ' );
	}

	/**
	 * Apply an image layer's controls to an img element. The transform is never
	 * set here, the loop owns it.
	 *
	 * @param {HTMLElement} el The img element.
	 * @param {Object} block The image control values.
	 * @return {void}
	 */
	function styleImage( el, block ) {
		if ( ! el || ! block ) {
			return;
		}

		// Only change the source when it differs, to avoid reloading the image.
		var url = block.url || '';
		if ( el.getAttribute( 'src' ) !== url ) {
			el.setAttribute( 'src', url );
		}

		el.style.width = num( block.width, 0 ) + 'px';
		el.style.height = num( block.height, 0 ) + 'px';
		el.style.objectFit = 'contain';
		el.style.mixBlendMode = block.blendMode || 'normal';
		el.style.zIndex = intval( block.zIndex, 100 );
	}

	/**
	 * Resolve any CSS colour (named, hex, rgb or rgba) to its red, green and blue
	 * parts, using the canvas to normalise it.
	 *
	 * @param {string} color The colour to resolve.
	 * @return {Array} The red, green and blue values.
	 */
	var _colorCtx = null;
	function colorToRgb( color ) {
		if ( ! _colorCtx ) {
			_colorCtx = document.createElement( 'canvas' ).getContext( '2d' );
		}
		// Seed with a known colour so an unparseable value stays predictable.
		_colorCtx.fillStyle = '#000000';
		_colorCtx.fillStyle = color;
		var normalised = _colorCtx.fillStyle;

		if ( '#' === normalised.charAt( 0 ) ) {
			return [
				parseInt( normalised.substr( 1, 2 ), 16 ),
				parseInt( normalised.substr( 3, 2 ), 16 ),
				parseInt( normalised.substr( 5, 2 ), 16 )
			];
		}
		var m = normalised.match( /rgba?\(([^)]+)\)/ );
		if ( m ) {
			var parts = m[ 1 ].split( ',' );
			return [ parseFloat( parts[ 0 ] ), parseFloat( parts[ 1 ] ), parseFloat( parts[ 2 ] ) ];
		}
		return [ 0, 0, 0 ];
	}

	/**
	 * Combine a fill colour with an opacity from 0 to 100.
	 *
	 * At 100 the colour is returned unchanged, so any alpha already in the colour
	 * (an rgba value or an eight digit hex) is kept. Below 100 the opacity is
	 * applied as the alpha channel.
	 *
	 * @param {string} fill    The fill colour.
	 * @param {number} opacity The opacity from 0 to 100.
	 * @return {string} The resulting colour.
	 */
	function fillWithOpacity( fill, opacity ) {
		fill = fill || 'transparent';
		var o = ( opacity === undefined || opacity === null ) ? 100 : num( opacity, 100 );
		if ( o >= 100 || 'transparent' === fill ) {
			return fill;
		}
		var rgb = colorToRgb( fill );
		return 'rgba(' + rgb[ 0 ] + ', ' + rgb[ 1 ] + ', ' + rgb[ 2 ] + ', ' + ( o / 100 ) + ')';
	}

	/**
	 * Apply a text layer's controls to a div element, including the optional
	 * background shape so a word can sit inside a filled circle or pill. The
	 * transform is never set here, the loop owns it, and the display is owned by
	 * the renderer's setVisible.
	 *
	 * @param {HTMLElement} el The text element.
	 * @param {Object} block The text control values.
	 * @return {void}
	 */
	function styleText( el, block ) {
		if ( ! el || ! block ) {
			return;
		}

		var bg = block.background || {};

		if ( el.textContent !== ( block.value || '' ) ) {
			el.textContent = block.value || '';
		}

		el.style.color = block.color || '#ffffff';
		el.style.fontFamily = block.font ? block.font : 'inherit';
		el.style.fontSize = num( block.size, 16 ) + 'px';
		el.style.fontWeight = block.weight || 'normal';
		el.style.lineHeight = '1';
		el.style.whiteSpace = 'nowrap';
		el.style.alignItems = 'center';
		el.style.justifyContent = 'center';
		el.style.boxSizing = 'border-box';
		el.style.mixBlendMode = block.blendMode || 'normal';
		el.style.zIndex = intval( block.zIndex, 100 );

		// The optional background box (circle or pill) the word sits inside.
		var hasBox = bg.shape && 'none' !== bg.shape;
		if ( hasBox ) {
			el.style.width = num( bg.width, 0 ) + 'px';
			el.style.height = num( bg.height, 0 ) + 'px';
			el.style.backgroundColor = fillWithOpacity( bg.fill, bg.fillOpacity );
			el.style.borderStyle = 'solid';
			el.style.borderWidth = num( bg.borderWidth, 0 ) + 'px';
			el.style.borderColor = bg.borderColor || 'transparent';
			el.style.borderRadius = cssLength( bg.borderRadius );
		} else {
			el.style.width = 'auto';
			el.style.height = 'auto';
			el.style.backgroundColor = 'transparent';
			el.style.borderWidth = '0';
			el.style.borderRadius = '0';
		}

		// Optional backdrop blur, the frosted glass effect that blurs the page
		// behind the background box. Only applied when there is a box.
		var blur = hasBox ? num( bg.backdropBlur, 0 ) : 0;
		var backdrop = blur > 0 ? ( 'blur(' + blur + 'px)' ) : '';
		el.style.backdropFilter = backdrop;
		el.style.webkitBackdropFilter = backdrop;
	}

	/* --------------------------------------------------------------------- */
	/* Shape cursor: an outer layer and an inner layer                       */
	/* --------------------------------------------------------------------- */

	/**
	 * Create a shape cursor, building its two layers inside a root element.
	 *
	 * @param {HTMLElement} root The element to append the layers to.
	 * @param {string} position The CSS position for the layers, absolute in the
	 *                          preview or fixed on the front end.
	 * @constructor
	 */
	function ShapeCursor( root, position ) {
		this.root = root;
		position = position || 'absolute';

		this.outer = document.createElement( 'div' );
		this.outer.className = 'kdna-cc-layer kdna-cc-layer-outer';
		this.outer.setAttribute( 'aria-hidden', 'true' );
		this.outer.style.position = position;

		this.inner = document.createElement( 'div' );
		this.inner.className = 'kdna-cc-layer kdna-cc-layer-inner';
		this.inner.setAttribute( 'aria-hidden', 'true' );
		this.inner.style.position = position;

		root.appendChild( this.outer );
		root.appendChild( this.inner );

		this.velocity = 0.15;
	}

	/**
	 * Apply a cursor's styling for a given state (normal or hover).
	 *
	 * @param {Object} cursor The cursor config.
	 * @param {string} state Either normal or hover.
	 * @return {void}
	 */
	ShapeCursor.prototype.apply = function ( cursor, state ) {
		var block = ( 'hover' === state ) ? cursor.hover : cursor.shape;
		if ( ! block || ! block.inner ) {
			block = cursor.shape || {};
		}
		styleLayer( this.inner, block.inner || {} );
		styleLayer( this.outer, block.outer || {} );
		this.velocity = clamp( ( block.outer && block.outer.velocity ) || 0, 0, 1 );
	};

	/**
	 * Position the two layers. The inner is locked to the pointer, the outer
	 * trails behind it.
	 *
	 * @param {number} ix Inner x.
	 * @param {number} iy Inner y.
	 * @param {number} ox Outer x.
	 * @param {number} oy Outer y.
	 * @return {void}
	 */
	ShapeCursor.prototype.place = function ( ix, iy, ox, oy ) {
		this.inner.style.transform = 'translate(' + ix + 'px,' + iy + 'px) translate(-50%, -50%)';
		this.outer.style.transform = 'translate(' + ox + 'px,' + oy + 'px) translate(-50%, -50%)';
	};

	/**
	 * Show or hide the two layers directly. Used on the front end where there
	 * is no wrapping overlay to toggle.
	 *
	 * @param {boolean} v True to show.
	 * @return {void}
	 */
	ShapeCursor.prototype.setVisible = function ( v ) {
		var d = v ? 'block' : 'none';
		this.outer.style.display = d;
		this.inner.style.display = d;
	};

	/**
	 * Remove the layers from the page.
	 *
	 * @return {void}
	 */
	ShapeCursor.prototype.remove = function () {
		if ( this.outer.parentNode ) {
			this.outer.parentNode.removeChild( this.outer );
		}
		if ( this.inner.parentNode ) {
			this.inner.parentNode.removeChild( this.inner );
		}
	};

	/* --------------------------------------------------------------------- */
	/* Image cursor: a single image layer                                    */
	/* --------------------------------------------------------------------- */

	/**
	 * Create an image cursor, a single img element following the pointer.
	 *
	 * @param {HTMLElement} root The element to append the image to.
	 * @param {string} position absolute in the preview or fixed on the front end.
	 * @constructor
	 */
	function ImageCursor( root, position ) {
		this.root = root;
		this.img = document.createElement( 'img' );
		this.img.className = 'kdna-cc-layer kdna-cc-layer-image';
		this.img.setAttribute( 'aria-hidden', 'true' );
		this.img.setAttribute( 'alt', '' );
		this.img.style.position = position || 'absolute';
		this.img.style.display = 'block';
		root.appendChild( this.img );

		// Image cursors lock to the pointer, there is no trailing ring.
		this.velocity = 0;
	}

	/**
	 * Apply the image cursor's styling for a state.
	 *
	 * @param {Object} cursor The cursor config.
	 * @param {string} state normal or hover.
	 * @return {void}
	 */
	ImageCursor.prototype.apply = function ( cursor, state ) {
		var block = ( 'hover' === state ) ? cursor.hover : cursor.image;
		if ( ! block || undefined === block.url ) {
			block = cursor.image || {};
		}
		styleImage( this.img, block );
		// One transition for the whole cursor, taken from the base block so both
		// the hover in and the hover out use the same easing.
		var base = cursor.image || {};
		applyTransition( this.img, base.transitionDuration, base.transitionTiming, IMAGE_TRANSITION_PROPS );
		this.velocity = 0;
	};

	/**
	 * Position the image at the pointer.
	 *
	 * @param {number} px Pointer x.
	 * @param {number} py Pointer y.
	 * @return {void}
	 */
	ImageCursor.prototype.place = function ( px, py ) {
		this.img.style.transform = 'translate(' + px + 'px,' + py + 'px) translate(-50%, -50%)';
	};

	/**
	 * Show or hide the image.
	 *
	 * @param {boolean} v True to show.
	 * @return {void}
	 */
	ImageCursor.prototype.setVisible = function ( v ) {
		this.img.style.display = v ? 'block' : 'none';
	};

	/**
	 * Remove the image from the page.
	 *
	 * @return {void}
	 */
	ImageCursor.prototype.remove = function () {
		if ( this.img.parentNode ) {
			this.img.parentNode.removeChild( this.img );
		}
	};

	/* --------------------------------------------------------------------- */
	/* Text cursor: a word or emoji, with an optional background shape       */
	/* --------------------------------------------------------------------- */

	/**
	 * Create a text cursor, a single element holding the word or emoji.
	 *
	 * @param {HTMLElement} root The element to append the text to.
	 * @param {string} position absolute in the preview or fixed on the front end.
	 * @constructor
	 */
	function TextCursor( root, position ) {
		this.root = root;
		this.el = document.createElement( 'div' );
		this.el.className = 'kdna-cc-layer kdna-cc-layer-text';
		this.el.setAttribute( 'aria-hidden', 'true' );
		this.el.style.position = position || 'absolute';
		// inline-flex shrink wraps to the word when there is no background box,
		// and centres the word when there is one.
		this.el.style.display = 'inline-flex';
		root.appendChild( this.el );

		// Text cursors lock to the pointer, there is no trailing ring.
		this.velocity = 0;
	}

	/**
	 * Apply the text cursor's styling for a state.
	 *
	 * @param {Object} cursor The cursor config.
	 * @param {string} state normal or hover.
	 * @return {void}
	 */
	TextCursor.prototype.apply = function ( cursor, state ) {
		var block = ( 'hover' === state ) ? cursor.hover : cursor.text;
		if ( ! block || undefined === block.value ) {
			block = cursor.text || {};
		}
		styleText( this.el, block );
		// One transition for the whole cursor, taken from the base block so both
		// the hover in and the hover out use the same easing, and the circle and
		// the word ease together.
		var base = cursor.text || {};
		applyTransition( this.el, base.transitionDuration, base.transitionTiming, TEXT_TRANSITION_PROPS );
		this.velocity = 0;
	};

	/**
	 * Position the text at the pointer.
	 *
	 * @param {number} px Pointer x.
	 * @param {number} py Pointer y.
	 * @return {void}
	 */
	TextCursor.prototype.place = function ( px, py ) {
		this.el.style.transform = 'translate(' + px + 'px,' + py + 'px) translate(-50%, -50%)';
	};

	/**
	 * Show or hide the text.
	 *
	 * @param {boolean} v True to show.
	 * @return {void}
	 */
	TextCursor.prototype.setVisible = function ( v ) {
		this.el.style.display = v ? 'inline-flex' : 'none';
	};

	/**
	 * Remove the text from the page.
	 *
	 * @return {void}
	 */
	TextCursor.prototype.remove = function () {
		if ( this.el.parentNode ) {
			this.el.parentNode.removeChild( this.el );
		}
	};

	/* --------------------------------------------------------------------- */
	/* Pointer engine: tracks the pointer and runs one rAF loop              */
	/* --------------------------------------------------------------------- */

	/**
	 * Create a pointer engine.
	 *
	 * Options:
	 *   mount    Element to append the cursor overlay to (preview stage or body).
	 *   host     Element to listen on for pointer events (defaults to mount).
	 *   local    True for coordinates relative to the mount rect (the preview),
	 *            false for viewport coordinates (the front end, fixed layers).
	 *   autoHide True to hide the cursor when the pointer leaves the host.
	 *
	 * @param {Object} opts The engine options.
	 * @constructor
	 */
	function PointerEngine( opts ) {
		opts = opts || {};
		this.mount = opts.mount || document.body;
		this.host = opts.host || this.mount;
		this.local = !! opts.local;
		this.autoHide = !! opts.autoHide;

		// In the preview (local) the layers live in a non-isolating absolute
		// overlay inside the mount. On the front end the layers are appended
		// straight to the mount as fixed elements, so mix-blend-mode can blend
		// against the page rather than being trapped in an isolated overlay.
		if ( this.local ) {
			this.overlay = document.createElement( 'div' );
			this.overlay.className = 'kdna-cc-cursor-root';
			this.overlay.style.position = 'absolute';
			this.overlay.style.top = '0';
			this.overlay.style.left = '0';
			this.overlay.style.right = '0';
			this.overlay.style.bottom = '0';
			this.overlay.style.pointerEvents = 'none';
			this.mount.appendChild( this.overlay );
			this.layerParent = this.overlay;
			this.layerPosition = 'absolute';
		} else {
			this.overlay = null;
			this.layerParent = this.mount;
			this.layerPosition = 'fixed';
		}

		// The active renderer is created lazily and rebuilt when the cursor type
		// changes between shape, image and text.
		this.renderer = null;
		this.rendererType = null;

		// The optional global cursor, the map of cursors by id and the ordered
		// list of class to cursor rules. The active cursor is whichever one
		// currently applies under the pointer.
		this.globalCursor = null;
		this.cursors = {};
		this.rules = [];
		this.forcedState = null;
		this.activeCursor = null;
		this.state = 'normal';
		this.lastTarget = null;

		// Position state, target is the pointer, outer trails toward it.
		this.tx = 0;
		this.ty = 0;
		this.ox = 0;
		this.oy = 0;
		this.placed = false;
		this.running = false;
		this.rafId = null;
		this.visible = false;

		// The last pointer position in viewport coordinates, used to rebind on
		// the kdna:content-added event.
		this.lastClientX = null;
		this.lastClientY = null;

		// Coalesces scroll re-resolution to one pass per animation frame.
		this._scrollScheduled = false;

		// Bind handlers once so they can be removed later.
		this._onMove = this._onMove.bind( this );
		this._onEnter = this._onEnter.bind( this );
		this._onLeave = this._onLeave.bind( this );
		this._onContentAdded = this._onContentAdded.bind( this );
		this._onScroll = this._onScroll.bind( this );
		this._loop = this._loop.bind( this );

		this.host.addEventListener( 'mousemove', this._onMove );
		if ( this.autoHide ) {
			this.host.addEventListener( 'mouseenter', this._onEnter );
			this.host.addEventListener( 'mouseleave', this._onLeave );
		}

		// On the front end, rebind under a stationary pointer when content is
		// injected or when the page scrolls, so the cursor reacts to whatever has
		// moved beneath it without needing a mouse move. Scroll is captured so it
		// also catches scrolling inside nested scroll containers.
		if ( ! this.local ) {
			document.addEventListener( 'kdna:content-added', this._onContentAdded );
			window.addEventListener( 'scroll', this._onScroll, { passive: true, capture: true } );
		}

		// Start hidden when auto hiding, otherwise reveal once a cursor is set.
		this.setVisible( false );
	}

	/**
	 * Set the active cursor and an optional forced state, then re-apply styling.
	 *
	 * The forced state lets the preview show the Hover state while it is being
	 * edited. With no forced state the engine uses real hover detection.
	 *
	 * @param {Object} cursor The cursor config.
	 * @param {string|null} forcedState normal, hover, or null for automatic.
	 * @return {void}
	 */
	PointerEngine.prototype.update = function ( cursor, forcedState ) {
		// Single cursor mode, used by the admin preview.
		this.globalCursor = cursor || null;
		this.cursors = {};
		this.rules = [];
		this.forcedState = forcedState || null;
		// Hide when there is no cursor. Otherwise the cursor stays hidden until
		// the first pointer move, which avoids a flash in the top left corner.
		if ( ! cursor ) {
			this.setVisible( false );
		}
		this._refresh();
	};

	/**
	 * Set the front-end configuration: an optional global cursor, the map of
	 * cursors by id, and the ordered list of class to cursor rules.
	 *
	 * @param {Object} globalCursor The global cursor, or null.
	 * @param {Object} cursors The cursors keyed by id.
	 * @param {Array} rules The ordered selector to cursor rules.
	 * @return {void}
	 */
	PointerEngine.prototype.setFront = function ( globalCursor, cursors, rules ) {
		this.globalCursor = globalCursor || null;
		this.cursors = cursors || {};
		this.rules = rules || [];
		this.forcedState = null;
		this._refresh();
	};

	/**
	 * Resolve which cursor and which state apply for what sits under the pointer.
	 *
	 * Rules are evaluated in order and the first match wins, fully swapping the
	 * active cursor. With no match the global cursor applies, which may be null.
	 * The state (normal or hover) is then resolved from the active cursor's own
	 * hover selector.
	 *
	 * @param {HTMLElement|null} target The element under the pointer.
	 * @return {Object} An object with cursor and state.
	 */
	PointerEngine.prototype._resolve = function ( target ) {
		var active = this.globalCursor;

		// First matching rule wins.
		if ( target && target.closest && this.rules && this.rules.length ) {
			for ( var i = 0; i < this.rules.length; i++ ) {
				var rule = this.rules[ i ];
				if ( ! rule || ! rule.selector ) {
					continue;
				}
				var matched = false;
				try {
					matched = !! target.closest( rule.selector );
				} catch ( err ) {
					matched = false;
				}
				if ( matched ) {
					var mapped = this.cursors[ rule.cursorId ];
					if ( mapped ) {
						active = mapped;
						break;
					}
				}
			}
		}

		// Resolve the internal state of the active cursor.
		var state = this.forcedState;
		if ( ! state ) {
			var hov = false;
			var sel = ( active && active.hoverSelector ) ? active.hoverSelector : '';
			if ( sel && target && target.closest ) {
				try {
					hov = !! target.closest( sel );
				} catch ( err2 ) {
					hov = false;
				}
			}
			state = hov ? 'hover' : 'normal';
		}

		return { cursor: active, state: state };
	};

	/**
	 * Make sure the renderer matches the given cursor type, rebuilding it when
	 * the type changes (a shape cursor swapping to a text cursor, say).
	 *
	 * @param {string} type shape, image or text.
	 * @return {void}
	 */
	PointerEngine.prototype._ensureRenderer = function ( type ) {
		if ( this.rendererType === type && this.renderer ) {
			return;
		}
		if ( this.renderer ) {
			this.renderer.remove();
		}
		if ( 'image' === type ) {
			this.renderer = new ImageCursor( this.layerParent, this.layerPosition );
		} else if ( 'text' === type ) {
			this.renderer = new TextCursor( this.layerParent, this.layerPosition );
		} else {
			this.renderer = new ShapeCursor( this.layerParent, this.layerPosition );
		}
		this.rendererType = type;

		// On the front end the new renderer must match the current visibility.
		if ( ! this.overlay ) {
			this.renderer.setVisible( this.visible );
		}
	};

	/**
	 * Build the right renderer for the cursor and apply its styling.
	 *
	 * @param {Object} cursor The cursor config.
	 * @param {string} state normal or hover.
	 * @return {void}
	 */
	PointerEngine.prototype._applyActive = function ( cursor, state ) {
		this._ensureRenderer( cursor.type || 'shape' );
		this.renderer.apply( cursor, state );
	};

	/**
	 * Re-resolve and apply styling for the last known pointer target. Used when
	 * the configuration changes rather than the pointer.
	 *
	 * @return {void}
	 */
	PointerEngine.prototype._refresh = function () {
		var res = this._resolve( this.lastTarget );
		this.activeCursor = res.cursor;
		this.state = res.state;
		if ( res.cursor ) {
			this._applyActive( res.cursor, res.state );
		} else if ( ! this.autoHide ) {
			this.setVisible( false );
		}
	};

	/**
	 * Handle pointer movement: update the target, swap or restyle the cursor as
	 * needed, then start the loop.
	 *
	 * @param {MouseEvent} e The mouse event.
	 * @return {void}
	 */
	/**
	 * Apply a resolution result: full swap when the active cursor changes, or
	 * restyle when only the internal state changes.
	 *
	 * @param {Object} res The result from _resolve.
	 * @return {void}
	 */
	PointerEngine.prototype._applyResolved = function ( res ) {
		if ( res.cursor !== this.activeCursor ) {
			this.activeCursor = res.cursor;
			this.state = res.state;
			if ( res.cursor ) {
				this._applyActive( res.cursor, res.state );
			}
		} else if ( res.cursor && res.state !== this.state ) {
			this.state = res.state;
			this._applyActive( res.cursor, res.state );
		}
	};

	PointerEngine.prototype._onMove = function ( e ) {
		// Nothing can apply if there is neither a global cursor nor any rules.
		if ( ! this.globalCursor && ( ! this.rules || ! this.rules.length ) ) {
			return;
		}

		var x;
		var y;
		if ( this.local ) {
			var r = this.mount.getBoundingClientRect();
			x = e.clientX - r.left;
			y = e.clientY - r.top;
		} else {
			x = e.clientX;
			y = e.clientY;
		}
		this.tx = x;
		this.ty = y;
		this.lastClientX = e.clientX;
		this.lastClientY = e.clientY;
		this.lastTarget = e.target;

		var res = this._resolve( e.target );
		this._applyResolved( res );

		// No cursor applies here and there is no global, so show nothing.
		if ( ! res.cursor ) {
			this.setVisible( false );
			this.placed = false;
			return;
		}

		// Snap on first sighting (or after being hidden) to avoid a corner flash.
		if ( ! this.placed ) {
			this.ox = x;
			this.oy = y;
			this.placed = true;
		}

		this.setVisible( true );
		this._start();
	};

	/**
	 * Re-resolve the active cursor at the last known pointer position against the
	 * current DOM, without needing a pointer move.
	 *
	 * Used when something other than the pointer changes what sits beneath it:
	 * the page scrolling, or content being injected. The cursor stays put on
	 * screen (the pointer has not moved) but swaps to match the element now under
	 * it.
	 *
	 * @return {void}
	 */
	PointerEngine.prototype._reresolve = function () {
		if ( this.local || null === this.lastClientX ) {
			return;
		}

		var el = document.elementFromPoint( this.lastClientX, this.lastClientY );
		if ( ! el ) {
			return;
		}

		this.lastTarget = el;
		var res = this._resolve( el );
		this._applyResolved( res );

		if ( ! res.cursor ) {
			this.setVisible( false );
			this.placed = false;
			return;
		}

		// Keep the cursor at the current pointer position.
		this.tx = this.ox = this.lastClientX;
		this.ty = this.oy = this.lastClientY;
		this.placed = true;
		if ( this.renderer ) {
			this.renderer.place( this.tx, this.ty, this.ox, this.oy );
		}
		this.setVisible( true );
	};

	/**
	 * Handle the kdna:content-added event by re-resolving under the pointer.
	 *
	 * @return {void}
	 */
	PointerEngine.prototype._onContentAdded = function () {
		this._reresolve();
	};

	/**
	 * Handle scrolling by re-resolving under the pointer, coalesced to one pass
	 * per animation frame so frequent scroll events stay cheap.
	 *
	 * @return {void}
	 */
	PointerEngine.prototype._onScroll = function () {
		if ( this._scrollScheduled ) {
			return;
		}
		this._scrollScheduled = true;
		var self = this;
		requestAnimationFrame( function () {
			self._scrollScheduled = false;
			self._reresolve();
		} );
	};

	/**
	 * Reveal the cursor when the pointer enters the host.
	 *
	 * @return {void}
	 */
	PointerEngine.prototype._onEnter = function () {
		if ( this.globalCursor ) {
			this.setVisible( true );
		}
	};

	/**
	 * Hide the cursor when the pointer leaves the host.
	 *
	 * @return {void}
	 */
	PointerEngine.prototype._onLeave = function () {
		this.setVisible( false );
		this.placed = false;
	};

	/**
	 * Start the rAF loop if it is not already running.
	 *
	 * @return {void}
	 */
	PointerEngine.prototype._start = function () {
		if ( ! this.running ) {
			this.running = true;
			this.rafId = requestAnimationFrame( this._loop );
		}
	};

	/**
	 * The single animation frame loop. LERP the outer layer toward the pointer,
	 * place both layers, then stop once the outer has settled.
	 *
	 * @return {void}
	 */
	PointerEngine.prototype._loop = function () {
		if ( ! this.renderer ) {
			this.running = false;
			return;
		}

		var catchUp = clamp( 1 - this.renderer.velocity, 0.06, 1 );
		this.ox += ( this.tx - this.ox ) * catchUp;
		this.oy += ( this.ty - this.oy ) * catchUp;
		this.renderer.place( this.tx, this.ty, this.ox, this.oy );

		var dx = this.tx - this.ox;
		var dy = this.ty - this.oy;
		if ( ( dx * dx + dy * dy ) < 0.05 ) {
			// Settled. Snap exactly and stop until the next movement.
			this.ox = this.tx;
			this.oy = this.ty;
			this.renderer.place( this.tx, this.ty, this.ox, this.oy );
			this.running = false;
			return;
		}

		this.rafId = requestAnimationFrame( this._loop );
	};

	/**
	 * Show or hide the cursor overlay.
	 *
	 * @param {boolean} v True to show.
	 * @return {void}
	 */
	PointerEngine.prototype.setVisible = function ( v ) {
		this.visible = v;
		if ( this.overlay ) {
			this.overlay.style.display = v ? 'block' : 'none';
		} else if ( this.renderer ) {
			this.renderer.setVisible( v );
		}
	};

	/**
	 * Tear the engine down, removing listeners and the overlay.
	 *
	 * @return {void}
	 */
	PointerEngine.prototype.destroy = function () {
		this.host.removeEventListener( 'mousemove', this._onMove );
		if ( this.autoHide ) {
			this.host.removeEventListener( 'mouseenter', this._onEnter );
			this.host.removeEventListener( 'mouseleave', this._onLeave );
		}
		if ( ! this.local ) {
			document.removeEventListener( 'kdna:content-added', this._onContentAdded );
			window.removeEventListener( 'scroll', this._onScroll, { capture: true } );
		}
		if ( this.rafId ) {
			cancelAnimationFrame( this.rafId );
		}
		if ( this.renderer ) {
			this.renderer.remove();
		}
		if ( this.overlay && this.overlay.parentNode ) {
			this.overlay.parentNode.removeChild( this.overlay );
		}
	};

	/* --------------------------------------------------------------------- */
	/* Front-end bootstrap                                                   */
	/* --------------------------------------------------------------------- */

	/**
	 * Run a callback once the document body is available.
	 *
	 * @param {Function} fn The callback.
	 * @return {void}
	 */
	function ready( fn ) {
		if ( document.body ) {
			fn();
		} else {
			document.addEventListener( 'DOMContentLoaded', fn );
		}
	}

	/**
	 * Decide whether the cursor engine should initialise on this device.
	 *
	 * Does not run on touch or coarse-pointer devices, on tablet or mobile
	 * widths when those options are on, or when reduced motion is requested and
	 * the option is on. In each of these cases the visitor keeps the native
	 * cursor.
	 *
	 * @param {Object} options The option toggles.
	 * @return {boolean} True if the engine should run.
	 */
	function shouldRun( options ) {
		options = options || {};

		if ( window.matchMedia ) {
			// A precise hovering pointer (a real mouse) is required.
			if ( ! window.matchMedia( '(hover: hover) and (pointer: fine)' ).matches ) {
				return false;
			}
			// Reduced motion falls back to the native cursor when the option is on.
			if ( options.respectReducedMotion && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) {
				return false;
			}
		}

		// Width based hiding for tablet and mobile.
		var width = window.innerWidth || document.documentElement.clientWidth || 0;
		if ( options.hideOnMobile && width <= 767 ) {
			return false;
		}
		if ( options.hideOnTablet && width >= 768 && width <= 1024 ) {
			return false;
		}

		return true;
	}

	/**
	 * Start the front-end cursor from a config object.
	 *
	 * Resolves the optional global cursor from the library and runs it with a
	 * single engine over the whole page. Honours the device and accessibility
	 * options, and the show native cursor option. Does nothing when no cursor is
	 * configured for this page.
	 *
	 * @param {Object} config The front-end config: cursors, globalCursorId, options.
	 * @return {void}
	 */
	KdnaCC.startFrontend = function ( config ) {
		if ( ! config ) {
			return;
		}

		var cursors = config.cursors || {};
		var globalId = config.globalCursorId || null;
		var globalCursor = ( globalId && cursors[ globalId ] ) ? cursors[ globalId ] : null;
		var rules = config.rules || [];

		// Nothing to run on this page if there is neither a global cursor nor
		// any class rules.
		if ( ! globalCursor && ! rules.length ) {
			return;
		}

		var options = config.options || {};

		ready( function () {
			// Honour touch, tablet, mobile and reduced motion. When we should
			// not run, leave the native cursor untouched.
			if ( ! shouldRun( options ) ) {
				return;
			}

			// Honour the show native cursor option by hiding the system cursor
			// when it is switched off.
			if ( false === options.showNativeCursor ) {
				document.documentElement.classList.add( 'kdna-cc-no-native' );
			}

			// One engine, over the whole document, in viewport coordinates. It
			// uses event delegation: a single mousemove listener on document and
			// element.closest on the target to evaluate the rules.
			var engine = new PointerEngine( {
				mount: document.body,
				host: document,
				local: false,
				autoHide: false
			} );
			engine.setFront( globalCursor, cursors, rules );

			// Keep a reference so later stages can update or tear it down.
			KdnaCC._frontend = engine;
		} );
	};

	/* --------------------------------------------------------------------- */
	/* Public surface                                                        */
	/* --------------------------------------------------------------------- */

	KdnaCC.PointerEngine = PointerEngine;
	KdnaCC.styleLayer = styleLayer;
	KdnaCC.styleImage = styleImage;
	KdnaCC.styleText = styleText;
	KdnaCC.cssLength = cssLength;
	KdnaCC.toHex = toHex;
	KdnaCC.num = num;
}() );
