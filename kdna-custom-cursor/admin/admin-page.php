<?php
/**
 * Settings page markup for KDNA Custom Cursor.
 *
 * A single page with three tabs and a sticky live preview pane on the right.
 * The working state lives in the Alpine.js component kdnaCcAdmin, defined in
 * admin/js/kdna-cc-admin.js. For Stage 1 the three tabs are placeholders, the
 * real builder, library and assignment tools arrive in later stages.
 *
 * @package KDNA_Custom_Cursor
 */

// Stop anyone loading this file directly outside of WordPress.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="wrap kdna-cc-wrap" x-data="kdnaCcAdmin" x-cloak>

	<h1 class="kdna-cc-title"><?php esc_html_e( 'KDNA Custom Cursor', 'kdna-custom-cursor' ); ?></h1>
	<p class="kdna-cc-subtitle">
		<?php esc_html_e( 'Build custom cursors and assign them to CSS classes on your Elementor pages.', 'kdna-custom-cursor' ); ?>
	</p>

	<div class="kdna-cc-layout">

		<div class="kdna-cc-main">

			<nav class="kdna-cc-tabs nav-tab-wrapper">
				<button type="button" class="nav-tab" :class="{ 'nav-tab-active': activeTab === 'library' }" @click="setTab('library')">
					<?php esc_html_e( 'Library', 'kdna-custom-cursor' ); ?>
				</button>
				<button type="button" class="nav-tab" :class="{ 'nav-tab-active': activeTab === 'builder' }" @click="setTab('builder')">
					<?php esc_html_e( 'Builder', 'kdna-custom-cursor' ); ?>
				</button>
				<button type="button" class="nav-tab" :class="{ 'nav-tab-active': activeTab === 'assignment' }" @click="setTab('assignment')">
					<?php esc_html_e( 'Assignment & Options', 'kdna-custom-cursor' ); ?>
				</button>
			</nav>

			<div class="kdna-cc-panels">

				<?php // Tab 1, Cursor Library. ?>
				<section class="kdna-cc-panel" x-show="activeTab === 'library'">
					<h2><?php esc_html_e( 'Cursor Library', 'kdna-custom-cursor' ); ?></h2>
					<p class="kdna-cc-placeholder">
						<?php esc_html_e( 'Your saved cursors will appear here as a grid, with Edit, Duplicate and Delete. The library and starter presets arrive in Stage 2.', 'kdna-custom-cursor' ); ?>
					</p>
				</section>

				<?php // Tab 2, Builder. ?>
				<section class="kdna-cc-panel" x-show="activeTab === 'builder'">
					<h2><?php esc_html_e( 'Builder', 'kdna-custom-cursor' ); ?></h2>
					<p class="kdna-cc-placeholder">
						<?php esc_html_e( 'The Shape, Image and Text builders, with a Normal and Hover toggle, arrive in Stage 2 and Stage 5.', 'kdna-custom-cursor' ); ?>
					</p>
				</section>

				<?php // Tab 3, Assignment and Options. ?>
				<section class="kdna-cc-panel" x-show="activeTab === 'assignment'">
					<h2><?php esc_html_e( 'Assignment & Options', 'kdna-custom-cursor' ); ?></h2>
					<p class="kdna-cc-placeholder">
						<?php esc_html_e( 'The global cursor, the class to cursor rules and the option toggles arrive in Stage 4 and Stage 6.', 'kdna-custom-cursor' ); ?>
					</p>
				</section>

			</div>

			<div class="kdna-cc-footer">
				<button type="button" class="button button-primary" @click="save()" :disabled="saving">
					<span x-show="!saving"><?php esc_html_e( 'Save Changes', 'kdna-custom-cursor' ); ?></span>
					<span x-show="saving" x-cloak><?php esc_html_e( 'Saving...', 'kdna-custom-cursor' ); ?></span>
				</button>
				<button type="button" class="button" @click="load()" :disabled="loading">
					<?php esc_html_e( 'Reload', 'kdna-custom-cursor' ); ?>
				</button>
				<span class="kdna-cc-message" :class="messageType" x-text="message" x-show="message" x-cloak></span>
			</div>

		</div>

		<?php // Sticky live preview pane. The full preview engine arrives in Stage 2. ?>
		<aside class="kdna-cc-preview">
			<h2 class="kdna-cc-preview-title"><?php esc_html_e( 'Live Preview', 'kdna-custom-cursor' ); ?></h2>
			<div class="kdna-cc-preview-stage">
				<p class="kdna-cc-placeholder">
					<?php esc_html_e( 'A live Normal and Hover preview, driven by the same engine as the front end, arrives in Stage 2.', 'kdna-custom-cursor' ); ?>
				</p>
			</div>
		</aside>

	</div>

</div>
