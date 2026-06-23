=== KDNA Custom Cursor ===
Contributors: krulldna
Tags: cursor, custom cursor, elementor, mouse, pointer
Requires at least: 6.0
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Build custom animated cursors in the WordPress admin and assign them to specific CSS classes on your Elementor pages, with an optional global cursor.

== Description ==

KDNA Custom Cursor lets you build custom mouse cursors in the WordPress admin and assign them to specific CSS classes on an Elementor page or template. A cursor is a small animated layer that follows the pointer, typically an inner shape plus a larger outer ring that lags behind for a trailing effect.

The heart of the plugin is per-class assignment. You save a library of cursors, then map each one to a CSS class. When the pointer moves over an element carrying that class, the active cursor fully swaps to the cursor mapped to it. An optional global cursor covers everything else.

Cursor types are Shape (inner plus outer), Image (uploaded PNG or SVG) and Text (a word or emoji, with an optional circular or pill background). Each cursor has its own Normal and Hover state.

The admin is built with vanilla JavaScript and Alpine.js, with no build step. Data is saved through admin-ajax into two WordPress options. There is no dependency on WooCommerce, and no custom database tables.

== Installation ==

1. Upload the kdna-custom-cursor folder to the /wp-content/plugins/ directory, or install the ZIP from Plugins, Add New, Upload Plugin.
2. Activate the plugin through the Plugins screen.
3. Go to Settings, KDNA Custom Cursor to build cursors and set up assignment.

== Build stages ==

This plugin is delivered in stages. The current build covers:

* Stage 1: Plugin skeleton, settings page shell, data model, AJAX save and load.

Still to come:

* Stage 2: Shape cursor builder plus live Normal and Hover preview.
* Stage 3: Front-end engine, render, velocity trail, blend, global cursor.
* Stage 4: Per-class assignment plus full hover swap.
* Stage 5: Image and Text cursor types.
* Stage 6: Options, presets, accessibility, dynamic-content rebind.
* Stage 7: Optional Elementor Advanced-tab cursor picker.

== Accessibility ==

When implemented, the front-end engine respects prefers-reduced-motion by falling back to the native cursor, marks cursor layers as aria-hidden, and never intercepts clicks. The engine does not initialise on touch or coarse-pointer devices.

== Changelog ==

= 1.0.0 =
* Stage 1. Plugin skeleton, Settings, KDNA Custom Cursor page with three tabs, the two-option data model with full sanitising, and the admin-ajax save and load round trip protected by a nonce and a capability check.
