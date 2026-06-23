/**
 * Admin script for KDNA Custom Cursor.
 *
 * Defines the Alpine.js component that holds the working state for the settings
 * page and talks to admin-ajax for saving and loading. For Stage 1 it manages
 * the active tab and proves the save and load round trip. Later stages build
 * the cursor editing on top of this same state.
 *
 * UK English throughout. No em dashes.
 */
( function () {
	'use strict';

	// Register our component before Alpine starts. This script runs during page
	// parse, while Alpine is deferred, so the listener is always in place first.
	document.addEventListener( 'alpine:init', function () {
		window.Alpine.data( 'kdnaCcAdmin', function () {
			return {
				// Which tab is showing.
				activeTab: 'library',

				// Request state, used to disable buttons and show messages.
				saving: false,
				loading: false,
				message: '',
				messageType: '',

				// The working copy of the saved data.
				cursors: [],
				settings: null,

				/**
				 * Runs once when the component mounts. Pull the saved data in.
				 */
				init: function () {
					this.load();
				},

				/**
				 * Switch the visible tab.
				 *
				 * @param {string} tab The tab key to show.
				 */
				setTab: function ( tab ) {
					this.activeTab = tab;
				},

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
				 * Save the current cursors and settings back to the server.
				 */
				save: function () {
					var self = this;
					self.saving = true;
					self.setMessage( '', '' );

					var body = {
						cursors: JSON.stringify( self.cursors || [] ),
						settings: JSON.stringify( self.settings || {} )
					};

					self.request( window.kdnaCcData.saveAction, body )
						.then( function ( res ) {
							if ( res && res.success ) {
								// Sync to exactly what the server stored.
								self.cursors = res.data.cursors || self.cursors;
								self.settings = res.data.settings || self.settings;
								self.setMessage( 'Saved.', 'success' );
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
				 * Set the status message and its type (success or error).
				 *
				 * @param {string} text The message text.
				 * @param {string} type The message type, used for styling.
				 */
				setMessage: function ( text, type ) {
					this.message = text;
					this.messageType = type ? 'kdna-cc-message-' + type : '';
				},

				/**
				 * Send a POST request to admin-ajax with the nonce attached.
				 *
				 * @param {string} action The admin-ajax action name.
				 * @param {Object} body   Extra fields to send.
				 * @return {Promise} A promise resolving to the parsed JSON reply.
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
