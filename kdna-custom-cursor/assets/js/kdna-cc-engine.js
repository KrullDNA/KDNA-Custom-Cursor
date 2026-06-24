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

	/* --------------------------------------------------------------------- */
	/* Shape cursor: an outer layer and an inner layer                       */
	/* --------------------------------------------------------------------- */

	/**
	 * Create a shape cursor, building its two layers inside a root element.
	 *
	 * @param {HTMLElement} root The element to append the layers to.
	 * @constructor
	 */
	function ShapeCursor( root ) {
		this.root = root;

		this.outer = document.createElement( 'div' );
		this.outer.className = 'kdna-cc-layer kdna-cc-layer-outer';
		this.outer.setAttribute( 'aria-hidden', 'true' );

		this.inner = document.createElement( 'div' );
		this.inner.className = 'kdna-cc-layer kdna-cc-layer-inner';
		this.inner.setAttribute( 'aria-hidden', 'true' );

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

		// The overlay holds the cursor layers, sitting over the mount.
		this.overlay = document.createElement( 'div' );
		this.overlay.className = 'kdna-cc-cursor-root';
		this.overlay.style.position = this.local ? 'absolute' : 'fixed';
		this.overlay.style.top = '0';
		this.overlay.style.left = '0';
		this.overlay.style.right = '0';
		this.overlay.style.bottom = '0';
		this.overlay.style.pointerEvents = 'none';
		this.mount.appendChild( this.overlay );

		this.shape = new ShapeCursor( this.overlay );

		this.cursor = null;
		this.forcedState = null;
		this.hovering = false;
		this.state = 'normal';

		// Position state, target is the pointer, outer trails toward it.
		this.tx = 0;
		this.ty = 0;
		this.ox = 0;
		this.oy = 0;
		this.placed = false;
		this.running = false;
		this.rafId = null;
		this.visible = false;

		// Bind handlers once so they can be removed later.
		this._onMove = this._onMove.bind( this );
		this._onEnter = this._onEnter.bind( this );
		this._onLeave = this._onLeave.bind( this );
		this._loop = this._loop.bind( this );

		this.host.addEventListener( 'mousemove', this._onMove );
		if ( this.autoHide ) {
			this.host.addEventListener( 'mouseenter', this._onEnter );
			this.host.addEventListener( 'mouseleave', this._onLeave );
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
		this.cursor = cursor;
		this.forcedState = forcedState || null;
		if ( ! this.autoHide ) {
			this.setVisible( !! cursor );
		}
		this._applyState();
	};

	/**
	 * Work out which state to show right now.
	 *
	 * @return {string} normal or hover.
	 */
	PointerEngine.prototype._resolveState = function () {
		if ( this.forcedState ) {
			return this.forcedState;
		}
		return this.hovering ? 'hover' : 'normal';
	};

	/**
	 * Apply the current cursor's styling for the resolved state.
	 *
	 * @return {void}
	 */
	PointerEngine.prototype._applyState = function () {
		if ( ! this.cursor ) {
			return;
		}
		this.state = this._resolveState();
		this.shape.apply( this.cursor, this.state );
	};

	/**
	 * The selector that triggers this cursor's own internal hover state.
	 *
	 * @return {string} The hover selector, or an empty string.
	 */
	PointerEngine.prototype._hoverSelector = function () {
		return ( this.cursor && this.cursor.hoverSelector ) ? this.cursor.hoverSelector : '';
	};

	/**
	 * Handle pointer movement: update the target, hover state and start the loop.
	 *
	 * @param {MouseEvent} e The mouse event.
	 * @return {void}
	 */
	PointerEngine.prototype._onMove = function ( e ) {
		if ( ! this.cursor ) {
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

		// Snap on first sighting so the cursor does not fly in from a corner.
		if ( ! this.placed ) {
			this.ox = x;
			this.oy = y;
			this.placed = true;
		}

		if ( this.autoHide ) {
			this.setVisible( true );
		}

		// Update hover from whatever sits under the pointer.
		var sel = this._hoverSelector();
		var nowHover = false;
		if ( sel && e.target && e.target.closest ) {
			try {
				nowHover = !! e.target.closest( sel );
			} catch ( err ) {
				nowHover = false;
			}
		}
		if ( nowHover !== this.hovering ) {
			this.hovering = nowHover;
			this._applyState();
		}

		this._start();
	};

	/**
	 * Reveal the cursor when the pointer enters the host.
	 *
	 * @return {void}
	 */
	PointerEngine.prototype._onEnter = function () {
		if ( this.cursor ) {
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
		var catchUp = clamp( 1 - this.shape.velocity, 0.06, 1 );
		this.ox += ( this.tx - this.ox ) * catchUp;
		this.oy += ( this.ty - this.oy ) * catchUp;
		this.shape.place( this.tx, this.ty, this.ox, this.oy );

		var dx = this.tx - this.ox;
		var dy = this.ty - this.oy;
		if ( ( dx * dx + dy * dy ) < 0.05 ) {
			// Settled. Snap exactly and stop until the next movement.
			this.ox = this.tx;
			this.oy = this.ty;
			this.shape.place( this.tx, this.ty, this.ox, this.oy );
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
		this.overlay.style.display = v ? 'block' : 'none';
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
		if ( this.rafId ) {
			cancelAnimationFrame( this.rafId );
		}
		this.shape.remove();
		if ( this.overlay.parentNode ) {
			this.overlay.parentNode.removeChild( this.overlay );
		}
	};

	/* --------------------------------------------------------------------- */
	/* Public surface                                                        */
	/* --------------------------------------------------------------------- */

	KdnaCC.PointerEngine = PointerEngine;
	KdnaCC.styleLayer = styleLayer;
	KdnaCC.cssLength = cssLength;
	KdnaCC.toHex = toHex;
	KdnaCC.num = num;
}() );
