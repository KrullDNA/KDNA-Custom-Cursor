/**
 * Admin script for KDNA Custom Cursor.
 *
 * Defines the Alpine.js component that runs the settings page: the Library, the
 * Shape builder with its Normal and Hover states, and the live preview driven by
 * the shared engine in assets/js/kdna-cc-engine.js. Saving and loading go through
 * the Stage 1 admin-ajax layer.
 *
 * UK English throughout. No em dashes.
 */
( function () {
	'use strict';

	// The single preview engine for the page, kept outside Alpine's reactive
	// data so Alpine does not try to proxy the engine and its DOM nodes.
	var previewEngine = null;

	/**
	 * Generate an id made of hex and hyphens, safe for our id charset.
	 *
	 * @return {string} A new cursor id in the form kdna-cc-<uuid>.
	 */
	function uuid() {
		var s = '';
		for ( var i = 0; i < 32; i++ ) {
			s += Math.floor( Math.random() * 16 ).toString( 16 );
			if ( 7 === i || 11 === i || 15 === i || 19 === i ) {
				s += '-';
			}
		}
		return 'kdna-cc-' + s;
	}

	/**
	 * Build a default shape layer. The outer layer also carries velocity.
	 *
	 * @param {boolean} isOuter True for the outer layer.
	 * @return {Object} The default layer values.
	 */
	function defaultLayer( isOuter ) {
		var layer = {
			width: isOuter ? 44 : 12,
			height: isOuter ? 44 : 12,
			color: isOuter ? 'transparent' : '#ffffff',
			borderWidth: isOuter ? 1 : 0,
			borderRadius: '100%',
			borderColor: isOuter ? '#ffffff' : 'transparent',
			transitionDuration: 150,
			transitionTiming: 'ease-out',
			blendMode: 'normal',
			zIndex: isOuter ? 101 : 100,
			backdropFilter: ''
		};
		if ( isOuter ) {
			layer.velocity = 0.15;
		}
		return layer;
	}

	/**
	 * Build a default shape block (an inner and an outer layer).
	 *
	 * @return {Object} The default shape block.
	 */
	function defaultShapeBlock() {
		return {
			inner: defaultLayer( false ),
			outer: defaultLayer( true )
		};
	}

	/**
	 * Build a default image block, kept so the saved object matches the server.
	 *
	 * @return {Object} The default image block.
	 */
	function defaultImageBlock() {
		return { url: '', attachmentId: 0, width: 40, height: 40, blendMode: 'normal', zIndex: 100 };
	}

	/**
	 * Build a default text block, kept so the saved object matches the server.
	 *
	 * @return {Object} The default text block.
	 */
	function defaultTextBlock() {
		return {
			value: '', font: '', size: 16, color: '#ffffff', weight: 'normal',
			blendMode: 'normal', zIndex: 100,
			background: { shape: 'none', width: 70, height: 70, fill: '#808080', borderWidth: 0, borderColor: 'transparent', borderRadius: '100%' }
		};
	}

	/**
	 * Build a brand new shape cursor with sensible defaults.
	 *
	 * @return {Object} A new cursor object.
	 */
	function newShapeCursor() {
		return {
			id: uuid(),
			name: '',
			type: 'shape',
			shape: defaultShapeBlock(),
			image: defaultImageBlock(),
			text: defaultTextBlock(),
			hover: defaultShapeBlock(),
			hoverSelector: 'a, button'
		};
	}

	/**
	 * Deep clone a plain object via JSON, used to decouple from Alpine proxies.
	 *
	 * @param {*} value The value to clone.
	 * @return {*} A deep clone.
	 */
	function clone( value ) {
		return JSON.parse( JSON.stringify( value ) );
	}

	// Register the component before Alpine boots.
	document.addEventListener( 'alpine:init', function () {
		window.Alpine.data( 'kdnaCcAdmin', function () {
			return {
				// Which tab is showing.
				activeTab: 'library',

				// Request and message state.
				saving: false,
				loading: false,
				message: '',
				messageType: '',

				// The saved data.
				cursors: [],
				settings: null,

				// Builder state.
				editing: null,
				editingState: 'normal',
				panelsOpen: { inner: true, outer: true },
				engineReady: false,

				// The full Shape control set from section 6 of the brief.
				shapeControls: [
					{ key: 'width', label: 'Width', type: 'range', min: 0, max: 200, step: 1, unit: 'px' },
					{ key: 'height', label: 'Height', type: 'range', min: 0, max: 200, step: 1, unit: 'px' },
					{ key: 'color', label: 'Colour', type: 'colour' },
					{ key: 'borderWidth', label: 'Border width', type: 'range', min: 0, max: 20, step: 1, unit: 'px' },
					{ key: 'borderColor', label: 'Border colour', type: 'colour' },
					{ key: 'borderRadius', label: 'Border radius', type: 'text', placeholder: '100% or 12px' },
					{ key: 'transitionDuration', label: 'Transition duration', type: 'range', min: 0, max: 1000, step: 10, unit: 'ms' },
					{ key: 'transitionTiming', label: 'Transition timing', type: 'select', options: [ 'ease', 'ease-out', 'ease-in-out', 'linear' ] },
					{ key: 'blendMode', label: 'Blending mode', type: 'select', options: [ 'normal', 'difference', 'multiply', 'screen', 'exclusion' ] },
					{ key: 'zIndex', label: 'Z-index', type: 'number' },
					{ key: 'backdropFilter', label: 'Backdrop filter', type: 'text', placeholder: 'e.g. blur(2px)' }
				],

				// The outer layer adds a velocity (trail) control.
				velocityControl: { key: 'velocity', label: 'Velocity (trail)', type: 'range', min: 0, max: 1, step: 0.01, unit: '' },

				/**
				 * Mount: load saved data, then create the preview engine.
				 */
				init: function () {
					var self = this;
					this.load();

					this.$nextTick( function () {
						if ( self.$refs.stage && window.KdnaCC && window.KdnaCC.PointerEngine ) {
							previewEngine = new window.KdnaCC.PointerEngine( {
								mount: self.$refs.stage,
								host: self.$refs.stage,
								local: true,
								autoHide: true
							} );
							self.engineReady = true;
							self.renderPreview();
						}
					} );
				},

				/**
				 * Switch the visible tab.
				 *
				 * @param {string} tab The tab key.
				 */
				setTab: function ( tab ) {
					this.activeTab = tab;
				},

				/**
				 * The shape block for the state currently being edited.
				 *
				 * @return {Object|null} editing.shape or editing.hover.
				 */
				stateBlock: function () {
					if ( ! this.editing ) {
						return null;
					}
					return ( 'hover' === this.editingState ) ? this.editing.hover : this.editing.shape;
				},

				/**
				 * The controls for a layer. The outer layer gains the velocity.
				 *
				 * @param {string} layerKey inner or outer.
				 * @return {Array} The control descriptors.
				 */
				controlsFor: function ( layerKey ) {
					if ( 'outer' === layerKey ) {
						return this.shapeControls.concat( [ this.velocityControl ] );
					}
					return this.shapeControls;
				},

				/**
				 * Read a control value for the current state and layer.
				 *
				 * @param {string} layerKey inner or outer.
				 * @param {string} key The control key.
				 * @return {*} The stored value.
				 */
				getVal: function ( layerKey, key ) {
					var block = this.stateBlock();
					return ( block && block[ layerKey ] ) ? block[ layerKey ][ key ] : '';
				},

				/**
				 * Write a control value for the current state and layer.
				 *
				 * @param {string} layerKey inner or outer.
				 * @param {Object} ctrl The control descriptor.
				 * @param {*} val The new value from the input.
				 */
				setVal: function ( layerKey, ctrl, val ) {
					var block = this.stateBlock();
					if ( ! block || ! block[ layerKey ] ) {
						return;
					}
					if ( 'range' === ctrl.type || 'number' === ctrl.type ) {
						var n = parseFloat( val );
						block[ layerKey ][ ctrl.key ] = isNaN( n ) ? 0 : n;
					} else {
						block[ layerKey ][ ctrl.key ] = val;
					}
				},

				/**
				 * A hex value for the colour swatch, derived from the stored colour.
				 *
				 * @param {string} layerKey inner or outer.
				 * @param {string} key The control key.
				 * @return {string} A hex colour.
				 */
				hexFor: function ( layerKey, key ) {
					return window.KdnaCC.toHex( this.getVal( layerKey, key ) );
				},

				/**
				 * Open or close a collapsible panel.
				 *
				 * @param {string} key inner or outer.
				 */
				togglePanel: function ( key ) {
					this.panelsOpen[ key ] = ! this.panelsOpen[ key ];
				},

				/* ----------------------------------------------------------- */
				/* Library actions                                             */
				/* ----------------------------------------------------------- */

				/**
				 * Start a new cursor of the given type and open the builder.
				 *
				 * @param {string} type shape, image or text.
				 */
				newCursor: function ( type ) {
					this.editing = newShapeCursor();
					if ( 'image' === type || 'text' === type ) {
						// The Shape build is proven first, other types follow in Stage 5.
						this.editing.type = type;
					}
					this.editingState = 'normal';
					this.activeTab = 'builder';
				},

				/**
				 * Open an existing cursor in the builder.
				 *
				 * @param {string} id The cursor id.
				 */
				editCursor: function ( id ) {
					var src = this.cursors.find( function ( c ) { return c.id === id; } );
					if ( ! src ) {
						return;
					}
					this.editing = clone( src );
					this.editingState = 'normal';
					this.activeTab = 'builder';
				},

				/**
				 * Duplicate a cursor under a new id, then persist.
				 *
				 * @param {string} id The cursor id to copy.
				 */
				duplicateCursor: function ( id ) {
					var src = this.cursors.find( function ( c ) { return c.id === id; } );
					if ( ! src ) {
						return;
					}
					var copy = clone( src );
					copy.id = uuid();
					copy.name = ( src.name || 'Cursor' ) + ' copy';
					this.cursors.push( copy );
					this.persist( 'Cursor duplicated.' );
				},

				/**
				 * Delete a cursor after confirmation, then persist.
				 *
				 * @param {string} id The cursor id to delete.
				 */
				deleteCursor: function ( id ) {
					if ( ! window.confirm( 'Delete this cursor? This cannot be undone.' ) ) {
						return;
					}
					this.cursors = this.cursors.filter( function ( c ) { return c.id !== id; } );
					if ( this.editing && this.editing.id === id ) {
						this.editing = null;
					}
					this.persist( 'Cursor deleted.' );
				},

				/* ----------------------------------------------------------- */
				/* Builder actions                                             */
				/* ----------------------------------------------------------- */

				/**
				 * Commit the cursor being edited into the library, then persist.
				 */
				saveCursor: function () {
					if ( ! this.editing ) {
						return;
					}
					if ( ! this.editing.name || ! this.editing.name.trim() ) {
						this.setMessage( 'Please give the cursor a name.', 'error' );
						return;
					}

					var copy = clone( this.editing );
					var idx = this.cursors.findIndex( function ( c ) { return c.id === copy.id; } );
					if ( idx >= 0 ) {
						this.cursors.splice( idx, 1, copy );
					} else {
						this.cursors.push( copy );
					}
					this.persist( 'Cursor saved.' );
				},

				/**
				 * Close the builder and return to the Library.
				 */
				cancelEdit: function () {
					this.editing = null;
					this.activeTab = 'library';
				},

				/* ----------------------------------------------------------- */
				/* Preview                                                     */
				/* ----------------------------------------------------------- */

				/**
				 * Push the cursor being edited into the preview engine.
				 *
				 * This runs inside x-effect, so reading the editing object deeply
				 * (via the clone) makes the effect re-run whenever any control
				 * changes. When editing the Hover state, the preview is forced to
				 * Hover so edits are visible straight away.
				 */
				renderPreview: function () {
					var data = this.editing ? clone( this.editing ) : null;
					var forced = ( 'hover' === this.editingState ) ? 'hover' : null;
					var ready = this.engineReady;

					if ( ! ready || ! previewEngine ) {
						return;
					}
					if ( ! data || 'shape' !== data.type ) {
						previewEngine.setVisible( false );
						return;
					}
					previewEngine.update( data, forced );
				},

				/**
				 * Render a small static thumbnail of a cursor into a card.
				 *
				 * @param {HTMLElement} el The thumbnail container.
				 * @param {Object} cursor The cursor to draw.
				 */
				renderThumb: function ( el, cursor ) {
					if ( ! el || ! window.KdnaCC ) {
						return;
					}
					el.innerHTML = '';

					if ( 'shape' !== cursor.type ) {
						// Image and Text thumbnails arrive in Stage 5.
						el.classList.add( 'is-placeholder' );
						el.textContent = cursor.type;
						return;
					}
					el.classList.remove( 'is-placeholder' );

					var outer = document.createElement( 'div' );
					outer.className = 'kdna-cc-layer kdna-cc-layer-outer';
					var inner = document.createElement( 'div' );
					inner.className = 'kdna-cc-layer kdna-cc-layer-inner';

					window.KdnaCC.styleLayer( outer, cursor.shape.outer );
					window.KdnaCC.styleLayer( inner, cursor.shape.inner );

					// Scale the layers down to fit the thumbnail box.
					var n = window.KdnaCC.num;
					var maxDim = Math.max(
						n( cursor.shape.outer.width ), n( cursor.shape.outer.height ),
						n( cursor.shape.inner.width ), n( cursor.shape.inner.height ), 1
					);
					var scale = Math.min( 1, 56 / maxDim );

					[ outer, inner ].forEach( function ( layer ) {
						layer.style.position = 'absolute';
						layer.style.left = '50%';
						layer.style.top = '50%';
						layer.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
						// Keep blends and transitions out of the static thumbnail.
						layer.style.mixBlendMode = 'normal';
						layer.style.transition = 'none';
						layer.style.willChange = 'auto';
					} );

					el.appendChild( outer );
					el.appendChild( inner );
				},

				/* ----------------------------------------------------------- */
				/* Persistence (Stage 1 AJAX layer)                            */
				/* ----------------------------------------------------------- */

				/**
				 * Load the saved cursors and settings from the server.
				 */
				load: function () {
					var self = this;
					self.loading = true;
					self.setMessage( '', '' );

					self.request( window.kdnaCcData.loadAction, {} )
						.then( function ( res ) {
							if ( res && res.success ) {
								self.cursors = res.data.cursors || [];
								self.settings = res.data.settings || null;
							} else {
								self.setMessage( 'Could not load saved data.', 'error' );
							}
						} )
						.catch( function () {
							self.setMessage( 'Could not load saved data.', 'error' );
						} )
						.finally( function () {
							self.loading = false;
						} );
				},

				/**
				 * Persist the current cursor library to the server.
				 *
				 * @param {string} okMessage The message to show on success.
				 */
				persist: function ( okMessage ) {
					var self = this;
					self.saving = true;
					self.setMessage( '', '' );

					self.request( window.kdnaCcData.saveAction, { cursors: JSON.stringify( self.cursors ) } )
						.then( function ( res ) {
							if ( res && res.success ) {
								self.cursors = res.data.cursors || self.cursors;
								self.setMessage( okMessage || 'Saved.', 'success' );
							} else {
								self.setMessage( 'Save failed.', 'error' );
							}
						} )
						.catch( function () {
							self.setMessage( 'Save failed.', 'error' );
						} )
						.finally( function () {
							self.saving = false;
						} );
				},

				/**
				 * Set the status message and its type.
				 *
				 * @param {string} text The message text.
				 * @param {string} type success or error.
				 */
				setMessage: function ( text, type ) {
					this.message = text;
					this.messageType = type ? 'kdna-cc-message-' + type : '';
				},

				/**
				 * POST to admin-ajax with the nonce attached.
				 *
				 * @param {string} action The action name.
				 * @param {Object} body Extra fields.
				 * @return {Promise} A promise resolving to the parsed JSON.
				 */
				request: function ( action, body ) {
					var data = window.kdnaCcData;
					var form = new URLSearchParams();
					form.append( 'action', action );
					form.append( 'nonce', data.nonce );
					Object.keys( body ).forEach( function ( key ) {
						form.append( key, body[ key ] );
					} );

					return fetch( data.ajaxUrl, {
						method: 'POST',
						credentials: 'same-origin',
						headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
						body: form.toString()
					} ).then( function ( response ) {
						return response.json();
					} );
				}
			};
		} );
	} );
}() );
