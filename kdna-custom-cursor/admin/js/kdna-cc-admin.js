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

	// A running counter for stable rule keys, so Alpine can track rule rows as
	// they are reordered without losing input focus. These keys are local only
	// and are dropped by the server on save.
	var keyCounter = 0;

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
		return { url: '', attachmentId: 0, width: 40, height: 40, blendMode: 'normal', zIndex: 100, transitionDuration: 150, transitionTiming: 'ease-out' };
	}

	/**
	 * Build a default text block, kept so the saved object matches the server.
	 *
	 * @return {Object} The default text block.
	 */
	function defaultTextBlock() {
		return {
			value: '', font: '', size: 16, color: '#ffffff', weight: 'normal',
			blendMode: 'normal', zIndex: 100, transitionDuration: 150, transitionTiming: 'ease-out',
			background: { shape: 'none', width: 70, height: 70, fill: '#808080', fillOpacity: 100, backdropBlur: 0, borderWidth: 0, borderColor: 'transparent', borderRadius: '100%' }
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

	/**
	 * Fill in any newer fields a cursor saved by an earlier version may lack, so
	 * the builder controls always have a value to bind to.
	 *
	 * @param {Object} cursor The cursor to normalise.
	 * @return {Object} The same cursor.
	 */
	function ensureDefaults( cursor ) {
		if ( ! cursor ) {
			return cursor;
		}
		// Backfill fields newer versions added on the image, text and hover
		// blocks. Shape blocks (with inner and outer) carry their own transition
		// values per layer, so they are left alone here.
		[ 'image', 'text', 'hover' ].forEach( function ( key ) {
			var block = cursor[ key ];
			if ( ! block || block.inner || block.outer ) {
				return;
			}
			if ( block.transitionDuration === undefined || block.transitionDuration === null ) {
				block.transitionDuration = 150;
			}
			if ( ! block.transitionTiming ) {
				block.transitionTiming = 'ease-out';
			}
			if ( block.background ) {
				if ( block.background.fillOpacity === undefined || block.background.fillOpacity === null ) {
					block.background.fillOpacity = 100;
				}
				if ( block.background.backdropBlur === undefined || block.background.backdropBlur === null ) {
					block.background.backdropBlur = 0;
				}
			}
		} );
		return cursor;
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

				// The starter presets, handed in by the server.
				presets: [],

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

					// Take the starter presets handed in by the server.
					this.presets = ( window.kdnaCcData && window.kdnaCcData.presets ) ? window.kdnaCcData.presets : [];

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
				 * The block for the state and type currently being edited.
				 *
				 * For the Normal state this is the type's own block (shape, image
				 * or text). For the Hover state it is the hover block, which
				 * mirrors the type.
				 *
				 * @return {Object|null} The block being edited.
				 */
				stateBlock: function () {
					if ( ! this.editing ) {
						return null;
					}
					if ( 'hover' === this.editingState ) {
						return this.editing.hover;
					}
					if ( 'image' === this.editing.type ) {
						return this.editing.image;
					}
					if ( 'text' === this.editing.type ) {
						return this.editing.text;
					}
					return this.editing.shape;
				},

				/**
				 * A default hover block for a type, cloned from that type's
				 * normal block so the hover state starts equal to normal.
				 *
				 * @param {Object} cursor The cursor being edited.
				 * @param {string} type shape, image or text.
				 * @return {Object} The hover block.
				 */
				defaultHoverFor: function ( cursor, type ) {
					if ( 'image' === type ) {
						return clone( cursor.image );
					}
					if ( 'text' === type ) {
						return clone( cursor.text );
					}
					return clone( cursor.shape );
				},

				/**
				 * Switch the cursor type, making the hover block match the type.
				 *
				 * @param {string} type shape, image or text.
				 */
				setType: function ( type ) {
					if ( ! this.editing || this.editing.type === type ) {
						return;
					}
					this.editing.type = type;
					this.editing.hover = this.defaultHoverFor( this.editing, type );
					this.editingState = 'normal';
				},

				/**
				 * A best effort hex value for a colour swatch.
				 *
				 * @param {string} value The stored colour.
				 * @return {string} A hex colour.
				 */
				toHex: function ( value ) {
					return window.KdnaCC.toHex( value );
				},

				/**
				 * Open the WordPress media library to choose an image for the
				 * current state's image block.
				 */
				pickImage: function () {
					var self = this;
					if ( ! window.wp || ! window.wp.media ) {
						self.setMessage( 'The media library is not available.', 'error' );
						return;
					}
					var frame = window.wp.media( {
						title: 'Select cursor image',
						library: { type: [ 'image' ] },
						multiple: false,
						button: { text: 'Use this image' }
					} );
					frame.on( 'select', function () {
						var att = frame.state().get( 'selection' ).first().toJSON();
						var block = self.stateBlock();
						if ( block ) {
							block.url = att.url;
							block.attachmentId = att.id;
						}
					} );
					frame.open();
				},

				/**
				 * Clear the chosen image from the current state's image block.
				 */
				clearImage: function () {
					var block = this.stateBlock();
					if ( block ) {
						block.url = '';
						block.attachmentId = 0;
					}
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
					type = ( 'image' === type || 'text' === type ) ? type : 'shape';
					var cursor = newShapeCursor();
					cursor.type = type;
					// Make the hover block match the chosen type.
					cursor.hover = this.defaultHoverFor( cursor, type );
					this.editing = cursor;
					this.editingState = 'normal';
					this.activeTab = 'builder';
				},

				/**
				 * Create a new editable cursor from a starter preset.
				 *
				 * @param {Object} preset The preset cursor to start from.
				 */
				usePreset: function ( preset ) {
					var cursor = ensureDefaults( clone( preset ) );
					cursor.id = uuid();
					this.editing = cursor;
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
					this.editing = ensureDefaults( clone( src ) );
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
					if ( ! data ) {
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
					el.classList.remove( 'is-placeholder' );
					var n = window.KdnaCC.num;

					// Image thumbnail: the chosen image, scaled to fit.
					if ( 'image' === cursor.type ) {
						if ( ! cursor.image || ! cursor.image.url ) {
							el.classList.add( 'is-placeholder' );
							el.textContent = 'image';
							return;
						}
						var thumbImg = document.createElement( 'img' );
						thumbImg.src = cursor.image.url;
						thumbImg.alt = '';
						thumbImg.style.maxWidth = '80%';
						thumbImg.style.maxHeight = '80%';
						thumbImg.style.objectFit = 'contain';
						el.appendChild( thumbImg );
						return;
					}

					// Text thumbnail: the word or emoji, with its background, scaled.
					if ( 'text' === cursor.type ) {
						var textEl = document.createElement( 'div' );
						textEl.className = 'kdna-cc-layer-text';
						window.KdnaCC.styleText( textEl, cursor.text );
						textEl.style.position = 'static';
						textEl.style.display = 'inline-flex';
						textEl.style.transition = 'none';
						textEl.style.mixBlendMode = 'normal';
						var hasBox = cursor.text.background && 'none' !== cursor.text.background.shape;
						var textMax = hasBox
							? Math.max( n( cursor.text.background.width ), n( cursor.text.background.height ), 1 )
							: Math.max( n( cursor.text.size ) * 3, 1 );
						textEl.style.transform = 'scale(' + Math.min( 1, 80 / textMax ) + ')';
						el.appendChild( textEl );
						return;
					}

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
				/* Assignment and options (Stage 4)                            */
				/* ----------------------------------------------------------- */

				/**
				 * Give every rule a stable local key so Alpine can track rows
				 * across reordering. The keys are never sent to the server.
				 *
				 * @param {Object|null} settings The settings object.
				 * @return {Object|null} The same settings, with keyed rules.
				 */
				keyRules: function ( settings ) {
					if ( settings && Array.isArray( settings.rules ) ) {
						settings.rules.forEach( function ( rule ) {
							if ( ! rule._k ) {
								rule._k = 'k' + ( keyCounter++ );
							}
						} );
					}
					return settings;
				},

				/**
				 * Set the global cursor, storing null when None is chosen.
				 *
				 * @param {string} value The selected cursor id, or an empty string.
				 */
				setGlobalCursor: function ( value ) {
					if ( this.settings ) {
						this.settings.globalCursorId = value || null;
					}
				},

				/**
				 * Add an empty rule row to the bottom of the list.
				 */
				addRule: function () {
					if ( ! this.settings ) {
						return;
					}
					this.settings.rules.push( { selector: '', cursorId: '', _k: 'k' + ( keyCounter++ ) } );
				},

				/**
				 * Remove a rule row by its position.
				 *
				 * @param {number} idx The row index.
				 */
				removeRule: function ( idx ) {
					this.settings.rules.splice( idx, 1 );
				},

				/**
				 * Move a rule row up or down, which changes its priority.
				 *
				 * @param {number} idx The row index.
				 * @param {number} dir Minus one to move up, plus one to move down.
				 */
				moveRule: function ( idx, dir ) {
					var arr = this.settings.rules;
					var j = idx + dir;
					if ( j < 0 || j >= arr.length ) {
						return;
					}
					var moved = arr.splice( idx, 1 )[ 0 ];
					arr.splice( j, 0, moved );
				},

				/**
				 * Save the global cursor and rules to the server.
				 */
				saveAssignment: function () {
					this.persistSettings( 'Assignment saved.' );
				},

				/**
				 * Persist the settings (global cursor, rules and options).
				 *
				 * @param {string} okMessage The message to show on success.
				 */
				persistSettings: function ( okMessage ) {
					var self = this;
					self.saving = true;
					self.setMessage( '', '' );

					self.request( window.kdnaCcData.saveAction, { settings: JSON.stringify( self.settings ) } )
						.then( function ( res ) {
							if ( res && res.success ) {
								self.settings = self.keyRules( res.data.settings || self.settings );
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
								self.settings = self.keyRules( res.data.settings || null );
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
